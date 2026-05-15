package com.pxwork.common.utils;

public final class JsonUtils {

    private JsonUtils() {
    }

    public static String cleanMarkdownJson(String text) {
        if (text == null || text.isBlank()) {
            return text;
        }
        int firstBrace = text.indexOf('{');
        int firstBracket = text.indexOf('[');
        int startIndex;
        if (firstBrace != -1 && firstBracket != -1) {
            startIndex = Math.min(firstBrace, firstBracket);
        } else {
            startIndex = Math.max(firstBrace, firstBracket);
        }

        int lastBrace = text.lastIndexOf('}');
        int lastBracket = text.lastIndexOf(']');
        int endIndex = Math.max(lastBrace, lastBracket);

        if (startIndex != -1 && endIndex != -1 && startIndex < endIndex) {
            return text.substring(startIndex, endIndex + 1);
        }

        return text.trim();
    }
}
