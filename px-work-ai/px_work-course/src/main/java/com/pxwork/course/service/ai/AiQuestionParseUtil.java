package com.pxwork.course.service.ai;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pxwork.common.utils.JsonUtils;
import com.pxwork.course.entity.Question;

@Component
public class AiQuestionParseUtil {

    private static final Logger log = LoggerFactory.getLogger(AiQuestionParseUtil.class);

    @Autowired
    private ObjectMapper objectMapper;

    public List<Question> parseQuestions(String aiRawJson, String jobRoleTag, Long defaultCourseId) throws Exception {
        String cleanedJson = JsonUtils.cleanMarkdownJson(aiRawJson);
        if (!StringUtils.hasText(cleanedJson)) {
            log.warn("AI返回数据清洗后为空，原始长度={}", aiRawJson == null ? "null" : aiRawJson.length());
            return List.of();
        }
        log.info("AI出卷清洗后JSON(前500字符): {}", cleanedJson.length() > 500 ? cleanedJson.substring(0, 500) + "..." : cleanedJson);

        JsonNode root = parseJsonNode(cleanedJson);
        if (root == null) {
            log.warn("AI出卷根节点解析失败，尝试从原始文本中提取数组");
            root = extractArrayNode(cleanedJson);
        }
        if (root == null) {
            return List.of();
        }

        JsonNode questionsArray = unwrapQuestionsArray(root);
        List<Question> result = new ArrayList<>();
        if (questionsArray != null) {
            log.info("从wrapper中成功提取到题目数组，元素数={}", questionsArray.size());
            for (JsonNode item : questionsArray) {
                Question question = toQuestion(item, jobRoleTag, defaultCourseId);
                if (question != null) {
                    result.add(question);
                } else {
                    log.warn("题目节点解析为null，节点内容: {}", item);
                }
            }
        }

        if (result.isEmpty()) {
            log.info("wrapper快速路径未命中，走递归遍历");
            processNode(root, jobRoleTag, defaultCourseId, result);
        }

        log.info("AI出卷最终解析题目数={}", result.size());
        return result;
    }

    private JsonNode unwrapQuestionsArray(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            return node;
        }
        if (!node.isObject()) {
            return null;
        }
        String[] wrapperKeys = {"clean_json", "data", "output", "result", "text", "questions", "items", "list"};
        for (String key : wrapperKeys) {
            JsonNode child = node.get(key);
            if (child == null || child.isNull()) {
                continue;
            }
            if (child.isArray()) {
                return child;
            }
            if (child.isObject()) {
                JsonNode deeper = unwrapQuestionsArray(child);
                if (deeper != null) {
                    return deeper;
                }
            }
            if (child.isTextual()) {
                JsonNode parsed = parseJsonNode(child.asText());
                if (parsed != null) {
                    if (parsed.isArray()) {
                        return parsed;
                    }
                    if (parsed.isObject()) {
                        JsonNode deeper = unwrapQuestionsArray(parsed);
                        if (deeper != null) {
                            return deeper;
                        }
                    }
                } else {
                    log.warn("解析wrapper字段[{}]失败，原始值前200字符: {}", key, abbreviate(child.asText(), 200));
                }
            }
        }

        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            JsonNode child = entry.getValue();
            if (child.isTextual()) {
                JsonNode parsed = parseJsonNode(child.asText());
                if (parsed != null && parsed.isArray()) {
                    return parsed;
                }
                JsonNode extracted = extractArrayNode(child.asText());
                if (extracted != null) {
                    return extracted;
                }
            }
        }
        JsonNode extracted = extractArrayNode(node.toString());
        if (extracted != null) {
            return extracted;
        }
        return null;
    }

    private JsonNode parseJsonNode(String rawText) {
        if (!StringUtils.hasText(rawText)) {
            return null;
        }
        String normalized = normalizeJsonText(rawText);
        if (!StringUtils.hasText(normalized)) {
            return null;
        }
        try {
            return objectMapper.readTree(normalized);
        } catch (Exception firstEx) {
            String cleaned = JsonUtils.cleanMarkdownJson(normalized);
            if (!normalized.equals(cleaned)) {
                try {
                    return objectMapper.readTree(cleaned);
                } catch (Exception ignored) {
                }
            }
            String unescaped = unescapeJsonLikeText(normalized);
            if (!normalized.equals(unescaped)) {
                try {
                    return objectMapper.readTree(unescaped);
                } catch (Exception ignored) {
                }
            }
            return null;
        }
    }

    private JsonNode extractArrayNode(String rawText) {
        if (!StringUtils.hasText(rawText)) {
            return null;
        }
        String normalized = normalizeJsonText(rawText);
        String[] markers = {"[{", "[\n{", "[\r\n{"};
        for (String marker : markers) {
            int start = normalized.indexOf(marker);
            if (start < 0) {
                continue;
            }
            int end = normalized.lastIndexOf("}]");
            if (end <= start) {
                continue;
            }
            String candidate = normalized.substring(start, end + 2);
            JsonNode parsed = parseJsonNode(candidate);
            if (parsed != null && parsed.isArray()) {
                return parsed;
            }
            candidate = unescapeJsonLikeText(candidate);
            parsed = parseJsonNode(candidate);
            if (parsed != null && parsed.isArray()) {
                return parsed;
            }
        }
        return null;
    }

    private String normalizeJsonText(String rawText) {
        String text = rawText == null ? null : rawText.trim();
        if (!StringUtils.hasText(text)) {
            return text;
        }
        text = text.replace("\uFEFF", "").trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("(?s)^```(?:json)?\\s*", "");
            text = text.replaceFirst("(?s)\\s*```$", "");
        }
        return text.trim();
    }

    private String unescapeJsonLikeText(String text) {
        if (!StringUtils.hasText(text)) {
            return text;
        }
        return text.replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\n", "\n")
                .replace("\\r", "\r")
                .replace("\\t", "\t");
    }

    private String abbreviate(String text, int maxLength) {
        if (text == null || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }

    private void processNode(JsonNode node, String jobRoleTag, Long defaultCourseId, List<Question> result) throws Exception {
        if (node == null || node.isNull()) {
            return;
        }

        if (node.isArray()) {
            for (JsonNode item : node) {
                processNode(item, jobRoleTag, defaultCourseId, result);
            }
            return;
        }

        if (!node.isObject()) {
            return;
        }

        Question question = toQuestion(node, jobRoleTag, defaultCourseId);
        if (question != null) {
            result.add(question);
        }

        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String key = entry.getKey();
            JsonNode child = entry.getValue();

            if ("options".equalsIgnoreCase(key)) {
                continue;
            }

            if (child.isArray() || child.isObject()) {
                processNode(child, jobRoleTag, defaultCourseId, result);
                continue;
            }

            if (child.isTextual()) {
                JsonNode parsed = parseJsonNode(child.asText());
                if (parsed != null) {
                    processNode(parsed, jobRoleTag, defaultCourseId, result);
                    continue;
                }
                JsonNode extracted = extractArrayNode(child.asText());
                if (extracted != null) {
                    processNode(extracted, jobRoleTag, defaultCourseId, result);
                    continue;
                }
                if (looksLikeJsonText(child.asText())) {
                    log.warn("递归解析字段[{}]的JSON文本失败，原始值前200字符: {}", key, abbreviate(child.asText(), 200));
                }
            }
        }
    }

    private boolean looksLikeJsonText(String text) {
        if (!StringUtils.hasText(text)) {
            return false;
        }
        String normalized = normalizeJsonText(text);
        return normalized.startsWith("{")
                || normalized.startsWith("[")
                || normalized.startsWith("```")
                || normalized.contains("[{");
    }

    // 🔴 这里的参数也改成了 defaultCourseId
    private Question toQuestion(JsonNode node, String jobRoleTag, Long defaultCourseId) throws Exception {
        if (node == null || node.isNull()) {
            return null;
        }
        String content = readText(node, "content", "question", "title");
        if (!StringUtils.hasText(content)) {
            return null;
        }
        Question question = new Question();
        question.setJobRoleTag(jobRoleTag);
        question.setQuestionType(normalizeQuestionType(readText(node, "question_type", "questionType", "type")));
        question.setContent(content);
        question.setStandardAnswer(readText(node, "standard_answer", "standardAnswer", "answer"));
        question.setAnalysis(readText(node, "analysis", "explanation", "reason"));

        // 🔴 这里的核心逻辑全改成了 courseId 相关的解析
        Long courseId = defaultCourseId;
        String courseText = readText(node, "course_id", "courseId");
        if (StringUtils.hasText(courseText)) {
            try {
                courseId = Long.parseLong(courseText);
            } catch (NumberFormatException ignored) {
            }
        }
        question.setCourseId(courseId); // 🔴 最终把解析出来的 courseId 存入实体对象

        JsonNode optionsNode = node.get("options");
        if (optionsNode != null && !optionsNode.isNull()) {
            if (optionsNode.isTextual()) {
                question.setOptions(optionsNode.asText());
            } else {
                question.setOptions(objectMapper.writeValueAsString(optionsNode));
            }
        }
        return question;
    }

    public String normalizeQuestionType(String rawType) {
        if (!StringUtils.hasText(rawType)) {
            return "short_answer";
        }
        String type = rawType.trim().toLowerCase();
        return switch (type) {
        case "single_choice", "single", "单选", "单选题" -> "single_choice";
        case "multiple_choice", "multiple", "多选", "多选题" -> "multiple_choice"; // 新增多选题映射
        case "true_false", "judge", "判断", "判断题" -> "true_false";            // 新增判断题映射
        case "short_answer", "short", "subjective", "简答", "简答题", "主观题" -> "short_answer";
        case "case_analysis", "case", "案例分析", "案例分析题" -> "case_analysis";
        case "practical_application", "practical", "实操", "实操题", "实操应用题" -> "practical_application";
        default -> type;
    };
    }

    private String readText(JsonNode node, String... names) {
        for (String name : names) {
            JsonNode value = node.get(name);
            if (value == null || value.isNull()) {
                continue;
            }
            String text = value.isTextual() ? value.asText() : value.toString();
            if (StringUtils.hasText(text)) {
                return text;
            }
        }
        return null;
    }
}
