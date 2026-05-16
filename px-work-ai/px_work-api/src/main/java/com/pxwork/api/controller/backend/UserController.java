package com.pxwork.api.controller.backend;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.pxwork.common.entity.Department;
import com.pxwork.common.entity.User;
import com.pxwork.common.entity.UserDepartment;
import com.pxwork.common.service.DepartmentService;
import com.pxwork.common.service.UserDepartmentService;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.Result;
import com.pxwork.system.entity.SysDict;
import com.pxwork.system.service.SysDictService;

import cn.dev33.satoken.secure.SaSecureUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * <p>
 * 学员管理 前端控制器
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Tag(name = "1.5 后台-学员信息管理")
@RestController
@RequestMapping("/backend/user")
public class UserController {
    private static final String DEFAULT_FRONTEND_USER_PASSWORD = "123456";

    @Autowired
    private UserService userService;
    @Autowired
    private SysDictService sysDictService;
    @Autowired
    private DepartmentService departmentService;
    @Autowired
    private UserDepartmentService userDepartmentService;

    @Operation(summary = "学员分页列表", description = "获取学员分页列表(单部门信息)")
    @GetMapping("/list")
    public Result<Page<User>> list(
            @RequestParam(defaultValue = "1") Integer current,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String name) {
        
        Page<User> page = new Page<>(current, size);
        return Result.success(userService.pageWithDepts(page, name));
    }

    @Operation(summary = "新增学员", description = "创建新学员(仅支持绑定一个部门)")
    @PostMapping("/create")
    public Result<Boolean> create(@RequestBody User user) {
        boolean success = userService.createUser(user);
        return success ? Result.success(true) : Result.fail("创建失败");
    }

    @Operation(summary = "修改学员", description = "更新学员信息(仅支持绑定一个部门)")
    @PutMapping("/update")
    public Result<Boolean> update(@RequestBody User user) {
        boolean success = userService.updateUser(user);
        return success ? Result.success(true) : Result.fail("更新失败");
    }

    @Operation(summary = "删除学员", description = "根据ID删除学员")
    @DeleteMapping("/delete/{id}")
    public Result<Boolean> delete(@PathVariable Long id) {
        boolean success = userService.removeById(id);
        return success ? Result.success(true) : Result.fail("删除失败");
    }

    @Operation(summary = "批量删除学员", description = "批量删除学员(同时清理部门关联)")
    @PostMapping("/batch-delete")
    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> batchDelete(@RequestBody List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Result.fail("参数错误");
        }
        List<Long> uniqueIds = ids.stream().filter(item -> item != null && item > 0).distinct().collect(Collectors.toList());
        if (uniqueIds.isEmpty()) {
            return Result.fail("参数错误");
        }
        userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>().in(UserDepartment::getUserId, uniqueIds));
        boolean removed = userService.removeByIds(uniqueIds);
        Map<String, Object> data = new HashMap<>();
        data.put("requested", uniqueIds.size());
        data.put("deleted", removed ? uniqueIds.size() : 0);
        return Result.success(data);
    }

    @Operation(summary = "批量导入学员")
    @PostMapping("/import")
    @Transactional(rollbackFor = Exception.class)
    public Result<Map<String, Object>> importUsers(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return Result.fail("文件不能为空");
        }
        ExcelMapListener listener = new ExcelMapListener();
        try {
            EasyExcel.read(file.getInputStream(), listener).sheet().doRead();
        } catch (IOException e) {
            return Result.fail("Excel 解析失败");
        }
        if (listener.rows == null || listener.rows.isEmpty()) {
            return Result.fail("Excel 数据为空");
        }
        List<SysDict> dicts = sysDictService.list(new LambdaQueryWrapper<SysDict>()
                .in(SysDict::getDictType, List.of("job_role")));
        Map<String, String> jobRoleDict = dicts.stream()
                .filter(item -> "job_role".equals(item.getDictType()))
                .collect(Collectors.toMap(SysDict::getDictLabel, SysDict::getDictValue, (a, b) -> a));
        int maxJobRoleSort = dicts.stream()
                .filter(item -> "job_role".equals(item.getDictType()))
                .map(SysDict::getSort)
                .filter(item -> item != null)
                .max(Integer::compareTo)
                .orElse(0);
        int[] jobRoleSort = new int[] { maxJobRoleSort + 1 };
        int[] createdJobRoleCount = new int[] { 0 };

        List<Department> existingDepts = departmentService.list();
        Map<String, Long> deptIndex = new HashMap<>();
        Map<Long, Integer> deptMaxSortMap = new HashMap<>();
        if (existingDepts != null) {
            for (Department dept : existingDepts) {
                if (dept == null || dept.getId() == null || dept.getParentId() == null || !StringUtils.hasText(normalize(dept.getName()))) {
                    continue;
                }
                deptIndex.put(deptKey(dept.getParentId(), dept.getName()), dept.getId());
                Integer currentMax = deptMaxSortMap.get(dept.getParentId());
                int sort = dept.getSort() == null ? 0 : dept.getSort();
                if (currentMax == null || sort > currentMax) {
                    deptMaxSortMap.put(dept.getParentId(), sort);
                }
            }
        }
        int[] createdDeptCount = new int[] { 0 };

        Map<String, User> importUserMap = new HashMap<>();
        List<String> errors = new ArrayList<>();
        for (int i = 0; i < listener.rows.size(); i++) {
            Map<String, String> row = listener.rows.get(i);
            int lineNo = i + 2;
            if (row == null || row.isEmpty()) {
                errors.add("第" + lineNo + "行为空");
                continue;
            }
            String name = firstText(row, "姓名");
            String account = firstText(row, "登录账号", "账号", "登录名", "邮箱", "Email", "email");
            String jobNo = firstText(row, "工号", "员工号", "工号/学号");
            String dept1 = firstText(row, "所属部门", "部门", "部门1", "一级部门");
            String dept2 = firstText(row, "部门2", "部门二", "二级部门");
            String office = firstText(row, "科室");
            String jobRoleLabel = firstText(row, "岗位角色", "职位", "岗位");

            if (!StringUtils.hasText(account) && StringUtils.hasText(jobNo)) {
                account = jobNo;
            }

            if (!StringUtils.hasText(name)
                    || !StringUtils.hasText(account)
                    || !StringUtils.hasText(jobRoleLabel)) {
                errors.add("第" + lineNo + "行存在必填项为空");
                continue;
            }
            String jobRoleValue = jobRoleDict.get(jobRoleLabel);
            if (jobRoleValue == null) {
                jobRoleValue = ensureJobRoleDict(jobRoleLabel, jobRoleDict, jobRoleSort);
                createdJobRoleCount[0] = createdJobRoleCount[0] + 1;
            }
            if (importUserMap.containsKey(account)) {
                errors.add("第" + lineNo + "行登录账号重复: " + account);
                continue;
            }

            Long departmentId = ensureDepartmentPath(dept1, dept2, office, deptIndex, deptMaxSortMap, createdDeptCount);
            User user = new User();
            user.setName(name);
            user.setAccount(account);
            user.setJobNo(jobNo);
            user.setDeptName(dept1);
            user.setOffice(office);
            user.setJobRole(jobRoleValue);
            user.setDepartmentId(departmentId);
            user.setPassword(SaSecureUtil.sha256(DEFAULT_FRONTEND_USER_PASSWORD));
            user.setIsFirstLogin(1);
            importUserMap.put(account, user);
        }
        if (!errors.isEmpty()) {
            return Result.fail(String.join("；", errors));
        }

        List<String> accounts = new ArrayList<>(importUserMap.keySet());
        List<User> exists = userService.list(new LambdaQueryWrapper<User>().in(User::getAccount, accounts));
        Map<String, User> existMap = exists.stream().collect(Collectors.toMap(User::getAccount, item -> item));

        List<User> inserts = new ArrayList<>();
        List<User> updates = new ArrayList<>();
        for (User importUser : importUserMap.values()) {
            User exist = existMap.get(importUser.getAccount());
            if (exist == null) {
                inserts.add(importUser);
            } else {
                importUser.setId(exist.getId());
                importUser.setPassword(exist.getPassword());
                importUser.setIsFirstLogin(exist.getIsFirstLogin());
                updates.add(importUser);
            }
        }
        if (!inserts.isEmpty()) {
            userService.saveBatch(inserts);
        }
        if (!updates.isEmpty()) {
            userService.updateBatchById(updates);
        }

        List<Long> changedUserIds = new ArrayList<>();
        List<UserDepartment> relations = new ArrayList<>();
        for (User u : inserts) {
            if (u.getId() != null && u.getDepartmentId() != null) {
                changedUserIds.add(u.getId());
                relations.add(new UserDepartment().setUserId(u.getId()).setDepartmentId(u.getDepartmentId()));
            }
        }
        for (User u : updates) {
            if (u.getId() != null && u.getDepartmentId() != null) {
                changedUserIds.add(u.getId());
                relations.add(new UserDepartment().setUserId(u.getId()).setDepartmentId(u.getDepartmentId()));
            }
        }
        if (!changedUserIds.isEmpty()) {
            userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>().in(UserDepartment::getUserId, changedUserIds));
            if (!relations.isEmpty()) {
                userDepartmentService.saveBatch(relations);
            }
        }

        Map<String, Object> data = new HashMap<>();
        data.put("total", listener.rows.size());
        data.put("inserted", inserts.size());
        data.put("updated", updates.size());
        data.put("departmentsCreated", createdDeptCount[0]);
        data.put("departmentLinked", relations.size());
        data.put("jobRolesCreated", createdJobRoleCount[0]);
        return Result.success(data);
    }

    private static String deptKey(Long parentId, String name) {
        return parentId + "|" + normalize(name);
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String s = value.trim();
        if ("/".equals(s)) {
            return null;
        }
        return s.isEmpty() ? null : s;
    }

    private static String firstText(Map<String, String> row, String... keys) {
        if (row == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (!StringUtils.hasText(key)) {
                continue;
            }
            String v = row.get(key.trim());
            if (StringUtils.hasText(v)) {
                return v.trim();
            }
        }
        return null;
    }

    private Long ensureDepartmentPath(String dept1, String dept2, String office, Map<String, Long> deptIndex, Map<Long, Integer> deptMaxSortMap, int[] createdDeptCount) {
        Long dept1Id = StringUtils.hasText(dept1) ? getOrCreateDept(0L, dept1, deptIndex, deptMaxSortMap, createdDeptCount) : null;
        Long dept2Id = StringUtils.hasText(dept2)
                ? getOrCreateDept(dept1Id == null ? 0L : dept1Id, dept2, deptIndex, deptMaxSortMap, createdDeptCount)
                : null;
        Long officeId = StringUtils.hasText(office)
                ? getOrCreateDept(dept2Id != null ? dept2Id : (dept1Id != null ? dept1Id : 0L), office, deptIndex, deptMaxSortMap, createdDeptCount)
                : null;
        if (officeId != null) {
            return officeId;
        }
        if (dept2Id != null) {
            return dept2Id;
        }
        return dept1Id;
    }

    private Long getOrCreateDept(Long parentId, String name, Map<String, Long> deptIndex, Map<Long, Integer> deptMaxSortMap, int[] createdDeptCount) {
        String normalizedName = normalize(name);
        if (!StringUtils.hasText(normalizedName)) {
            return null;
        }
        String key = deptKey(parentId, normalizedName);
        Long existed = deptIndex.get(key);
        if (existed != null) {
            return existed;
        }
        Department dept = new Department();
        dept.setParentId(parentId);
        dept.setName(normalizedName);
        int nextSort = 0;
        if (deptMaxSortMap != null) {
            Integer currentMax = deptMaxSortMap.get(parentId);
            nextSort = (currentMax == null ? 0 : currentMax) + 1;
            deptMaxSortMap.put(parentId, nextSort);
        }
        dept.setSort(nextSort);
        boolean saved = departmentService.save(dept);
        if (!saved || dept.getId() == null) {
            throw new IllegalStateException("创建部门失败: " + normalizedName);
        }
        deptIndex.put(key, dept.getId());
        if (createdDeptCount != null && createdDeptCount.length > 0) {
            createdDeptCount[0] = createdDeptCount[0] + 1;
        }
        return dept.getId();
    }

    private String ensureJobRoleDict(String jobRoleLabel, Map<String, String> jobRoleDict, int[] jobRoleSort) {
        String normalizedLabel = normalize(jobRoleLabel);
        if (!StringUtils.hasText(normalizedLabel)) {
            return null;
        }
        String existed = jobRoleDict.get(normalizedLabel);
        if (existed != null) {
            return existed;
        }
        SysDict existing = sysDictService.getOne(new LambdaQueryWrapper<SysDict>()
                .eq(SysDict::getDictType, "job_role")
                .eq(SysDict::getDictLabel, normalizedLabel)
                .last("limit 1"));
        if (existing != null && StringUtils.hasText(existing.getDictValue())) {
            jobRoleDict.put(normalizedLabel, existing.getDictValue());
            return existing.getDictValue();
        }

        SysDict created = new SysDict();
        created.setDictType("job_role");
        created.setDictLabel(normalizedLabel);
        created.setDictValue(normalizedLabel);
        created.setSort(jobRoleSort != null && jobRoleSort.length > 0 ? jobRoleSort[0] : 0);
        if (jobRoleSort != null && jobRoleSort.length > 0) {
            jobRoleSort[0] = jobRoleSort[0] + 1;
        }
        boolean saved = sysDictService.save(created);
        if (!saved) {
            throw new IllegalStateException("创建岗位角色字典失败: " + normalizedLabel);
        }
        jobRoleDict.put(normalizedLabel, normalizedLabel);
        return normalizedLabel;
    }

    private static class ExcelMapListener extends AnalysisEventListener<Map<Integer, String>> {
        private Map<Integer, String> headMap = new HashMap<>();
        private final List<Map<String, String>> rows = new ArrayList<>();

        @Override
        public void invokeHeadMap(Map<Integer, String> headMap, AnalysisContext context) {
            if (headMap != null) {
                this.headMap = new HashMap<>(headMap);
            }
        }

        @Override
        public void invoke(Map<Integer, String> data, AnalysisContext context) {
            if (data == null || data.isEmpty()) {
                return;
            }
            Map<String, String> row = new HashMap<>();
            for (Map.Entry<Integer, String> headEntry : headMap.entrySet()) {
                Integer col = headEntry.getKey();
                String header = normalize(headEntry.getValue());
                if (!StringUtils.hasText(header)) {
                    continue;
                }
                String value = data.get(col);
                if (value != null) {
                    row.put(header, value.trim());
                }
            }
            if (!row.isEmpty()) {
                rows.add(row);
            }
        }

        @Override
        public void doAfterAllAnalysed(AnalysisContext context) {
        }
    }
}
