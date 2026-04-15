import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const trimValue = (v) => (typeof v === "string" ? v.trim() : "");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── CLIENT REGISTER ──────────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const username = trimValue(req.body?.username);
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);

    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: "用户名、邮箱和密码不能为空" });
    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: "邮箱格式无效" });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: "密码至少需要6位" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: "该邮箱已被注册" });

    const user = await User.create({ username, email, password, role: "client" });

    return res.status(201).json({
      success: true,
      message: "注册成功",
      token: generateToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "注册失败", error: err.message });
  }
};

// ─── CLIENT LOGIN ─────────────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);

    if (!email || !password)
      return res.status(400).json({ success: false, message: "邮箱和密码不能为空" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: "邮箱或密码错误" });

    if (!user.is_active)
      return res.status(403).json({ success: false, message: "账号已被禁用" });

    // Client-only login — employees and admins have their own endpoints
    if (user.role !== "client")
      return res.status(403).json({
        success: false,
        message:
          user.role === "employee"
            ? "请使用员工入口登录"
            : "请使用管理员入口登录",
      });

    return res.status(200).json({
      success: true,
      message: "登录成功",
      token: generateToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "登录失败", error: err.message });
  }
};

// ─── GET ME ───────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({ success: true, user: req.user.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ success: false, message: "获取用户失败", error: err.message });
  }
};

// ─── EMPLOYEE: SEND VERIFICATION CODE ────────────────────────────────────────
export const sendEmployeeVerificationCode = async (req, res) => {
  try {
    const phone = trimValue(req.body?.phone_number);
    if (!phone)
      return res.status(400).json({ success: false, message: "手机号不能为空" });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await User.findOneAndUpdate(
      { phone_number: phone, role: "employee", phone_verified: false },
      { phone_verification_code: code, phone_verification_expires: expires },
      { upsert: false }
    );

    return res.status(200).json({
      success: true,
      message: "验证码已发送（开发模式）",
      dev_code: code,
      expires_at: expires,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "发送验证码失败", error: err.message });
  }
};

// ─── EMPLOYEE REGISTER ────────────────────────────────────────────────────────
export const employeeRegister = async (req, res) => {
  try {
    const username = trimValue(req.body?.username);
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);
    const phone_number = trimValue(req.body?.phone_number);
    const code = trimValue(req.body?.code);

    if (!username || !email || !password || !phone_number || !code)
      return res.status(400).json({ success: false, message: "所有字段均为必填项" });
    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: "邮箱格式无效" });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: "密码至少需要6位" });

    const emailExists = await User.findOne({ email });
    if (emailExists)
      return res.status(400).json({ success: false, message: "该邮箱已被注册" });

    const user = await User.create({
      username, email, password, phone_number,
      phone_verified: true, role: "employee",
    });

    return res.status(201).json({
      success: true,
      message: "员工账号注册成功",
      token: generateToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "员工注册失败", error: err.message });
  }
};

// ─── EMPLOYEE LOGIN ───────────────────────────────────────────────────────────
export const employeeLogin = async (req, res) => {
  try {
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);

    if (!email || !password)
      return res.status(400).json({ success: false, message: "邮箱和密码不能为空" });

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: "邮箱或密码错误" });

    if (user.role !== "employee")
      return res.status(403).json({ success: false, message: "该账号不是员工账号" });

    if (!user.is_active)
      return res.status(403).json({ success: false, message: "账号已被禁用" });

    return res.status(200).json({
      success: true,
      message: "员工登录成功",
      token: generateToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "员工登录失败", error: err.message });
  }
};

// ─── SUPER ADMIN / ADMIN LOGIN ────────────────────────────────────────────────
// Handles both super_admin (fixed credentials) and admin (created by super admin)
export const superAdminLogin = async (req, res) => {
  try {
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);

    if (!email || !password)
      return res.status(400).json({ success: false, message: "邮箱和密码不能为空" });

    const SA_EMAIL = "superadmin@futuristicgamingproject";
    const SA_PASS  = "AdminPanel@@FuturisticGaming";

    // ── Super Admin: fixed hardcoded credentials ──────────────────────────────
    if (email === SA_EMAIL) {
      if (password !== SA_PASS)
        return res.status(401).json({ success: false, message: "超管凭据错误" });

      // Auto-create super admin in DB on first login
      let admin = await User.findOne({ role: "super_admin" });
      if (!admin) {
        admin = await User.create({
          username: "SuperAdmin",
          email: SA_EMAIL,
          password: SA_PASS,
          role: "super_admin",
        });
      }

      return res.status(200).json({
        success: true,
        message: "超管登录成功",
        token: generateToken(admin._id),
        user: admin.toSafeObject(),
      });
    }

    // ── Regular Admin: created by super admin via panel ───────────────────────
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: "邮箱或密码错误" });

    if (user.role !== "admin")
      return res.status(403).json({ success: false, message: "该账号没有管理员权限" });

    if (!user.is_active)
      return res.status(403).json({ success: false, message: "账号已被禁用" });

    return res.status(200).json({
      success: true,
      message: "管理员登录成功",
      token: generateToken(user._id),
      user: user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "管理员登录失败", error: err.message });
  }
};
