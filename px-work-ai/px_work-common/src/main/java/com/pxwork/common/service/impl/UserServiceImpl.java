package com.pxwork.common.service.impl;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pxwork.common.entity.Department;
import com.pxwork.common.entity.User;
import com.pxwork.common.entity.UserDepartment;
import com.pxwork.common.mapper.UserMapper;
import com.pxwork.common.request.FrontendLoginRequest;
import com.pxwork.common.service.DepartmentService;
import com.pxwork.common.service.UserDepartmentService;
import com.pxwork.common.service.UserService;
import com.pxwork.common.utils.StpUserUtil;

import cn.dev33.satoken.secure.SaSecureUtil;

/**
 * <p>
 * 学员用户表 服务实现类
 * </p>
 *
 * @author TraeAI
 * @since 2026-03-13
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {
    private static final String DEFAULT_FRONTEND_USER_PASSWORD = "123456";

    @Autowired
    private UserDepartmentService userDepartmentService;
    
    @Autowired
    private DepartmentService departmentService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean createUser(User user) {
        String rawPassword = StringUtils.isNotBlank(user.getPassword()) ? user.getPassword() : DEFAULT_FRONTEND_USER_PASSWORD;
        user.setPassword(SaSecureUtil.sha256(rawPassword));
        if (user.getIsFirstLogin() == null) {
            user.setIsFirstLogin(1);
        }
        boolean saved = this.save(user);
        if (!saved) {
            return false;
        }
        userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>()
                .eq(UserDepartment::getUserId, user.getId()));
        saveDepartment(user.getId(), user.getDepartmentId());
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean updateUser(User user) {
        if (StringUtils.isNotBlank(user.getPassword())) {
            user.setPassword(SaSecureUtil.sha256(user.getPassword()));
        } else {
            user.setPassword(null);
        }
        boolean updated = this.updateById(user);
        if (!updated) {
            return false;
        }
        userDepartmentService.remove(new LambdaQueryWrapper<UserDepartment>()
                .eq(UserDepartment::getUserId, user.getId()));
        saveDepartment(user.getId(), user.getDepartmentId());
        return true;
    }
    
    @Override
    public Page<User> pageWithDepts(Page<User> page, String name) {
        LambdaQueryWrapper<User> queryWrapper = new LambdaQueryWrapper<>();
        if (StringUtils.isNotBlank(name)) {
            queryWrapper.like(User::getName, name);
        }
        queryWrapper.orderByDesc(User::getCreatedAt);
        
        Page<User> userPage = this.page(page, queryWrapper);
        
        if (userPage.getRecords().isEmpty()) {
            return userPage;
        }
        enrichUsersWithDepartments(userPage.getRecords());
        return userPage;
    }

    @Override
    public User getUserWithDept(Long userId) {
        if (userId == null || userId <= 0) {
            return null;
        }
        User user = this.getById(userId);
        if (user == null) {
            return null;
        }
        enrichUsersWithDepartments(List.of(user));
        return user;
    }

    @Override
    public Map<String, Object> login(FrontendLoginRequest request) {
        String loginAccount = StringUtils.isNotBlank(request.getAccount()) ? request.getAccount() : request.getIdCard();
        User user = this.getOne(new LambdaQueryWrapper<User>()
                .and(wrapper -> wrapper.eq(User::getAccount, loginAccount)
                        .or().eq(User::getJobNo, loginAccount)));
        if (user == null) {
            throw new RuntimeException("账号或密码错误");
        }
        String password = SaSecureUtil.sha256(request.getPassword());
        if (!password.equals(user.getPassword())) {
            throw new RuntimeException("账号或密码错误");
        }
        StpUserUtil.login(user.getId());
        Map<String, Object> loginInfo = new HashMap<>();
        loginInfo.put("token", StpUserUtil.getTokenValue());
        loginInfo.put("isFirstLogin", user.getIsFirstLogin());
        return loginInfo;
    }

    private void saveDepartment(Long userId, Long departmentId) {
        if (departmentId != null && departmentId > 0) {
            UserDepartment userDepartment = new UserDepartment();
            userDepartment.setUserId(userId);
            userDepartment.setDepartmentId(departmentId);
            userDepartmentService.save(userDepartment);
        }
    }

    private void enrichUsersWithDepartments(List<User> users) {
        if (users == null || users.isEmpty()) {
            return;
        }
        List<Long> userIds = users.stream()
                .map(User::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
        if (userIds.isEmpty()) {
            return;
        }

        List<UserDepartment> userDepartments = userDepartmentService.list(new LambdaQueryWrapper<UserDepartment>()
                .in(UserDepartment::getUserId, userIds));
        Map<Long, Long> userDeptIdMap = userDepartments.stream()
                .filter(item -> item.getUserId() != null)
                .collect(Collectors.toMap(UserDepartment::getUserId, UserDepartment::getDepartmentId, (first, second) -> first));

        Map<Long, Department> deptMap = departmentService.list().stream()
                .filter(dept -> dept != null && dept.getId() != null)
                .collect(Collectors.toMap(Department::getId, dept -> dept, (first, second) -> first));

        for (User user : users) {
            Long departmentId = userDeptIdMap.get(user.getId());
            if (departmentId == null || departmentId <= 0) {
                user.setDepartmentId(null);
                user.setDepartment(null);
                continue;
            }
            user.setDepartmentId(departmentId);
            user.setDepartment(deptMap.get(departmentId));

            List<String> chain = buildDepartmentChain(departmentId, deptMap);
            if (chain.isEmpty()) {
                continue;
            }
            if (chain.size() == 1) {
                user.setDeptName(chain.get(0));
                user.setOffice("");
            } else if (chain.size() == 2) {
                user.setDeptName(String.join("-", chain));
                user.setOffice("");
            } else {
                user.setDeptName(String.join("-", chain.subList(0, 2)));
                user.setOffice(chain.get(2));
            }
        }
    }

    private List<String> buildDepartmentChain(Long departmentId, Map<Long, Department> deptMap) {
        if (departmentId == null || departmentId <= 0 || deptMap == null || deptMap.isEmpty()) {
            return List.of();
        }
        Set<String> names = new LinkedHashSet<>();
        List<String> reversed = new ArrayList<>();
        Long currentId = departmentId;
        int guard = 0;
        while (currentId != null && currentId > 0 && guard < 20) {
            Department current = deptMap.get(currentId);
            if (current == null) {
                break;
            }
            String name = normalizeDepartmentName(current.getName());
            if (StringUtils.isNotBlank(name)) {
                reversed.add(name);
            }
            currentId = current.getParentId();
            guard += 1;
        }
        for (int i = reversed.size() - 1; i >= 0; i--) {
            names.add(reversed.get(i));
        }
        return new ArrayList<>(names);
    }

    private String normalizeDepartmentName(String name) {
        if (StringUtils.isBlank(name)) {
            return null;
        }
        String value = name.trim();
        return "/".equals(value) ? null : value;
    }
}
