import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const trimValue = (v) => (typeof v === "string" ? v.trim() : "");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// ─── CLIENT REGISTER ───────────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const username = trimValue(req.body?.username);
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);
    const role = "client"; // clients always register as client

    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: "用户名、邮箱和密码不能为空" });

    if (!isValidEmail(email))
      return res.status(400).json({ success: false, message: "邮箱格式无效" });

    if (password.length < 6)
      return res.status(400).json({ success: false, message: "密码至少需要6位" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ success: false, message: "该邮箱已被注册" });

    const user = await User.create({ username, email, password, role });

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

// ─── CLIENT LOGIN ───────────────────────────────────────────────────────────
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

    // Clients only — employees must use /employee/login
    if (user.role !== "client" && user.role !== "admin" && user.role !== "super_admin")
      return res.status(403).json({ success: false, message: "请使用员工登录入口" });

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

// ─── GET ME ─────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({ success: true, user: req.user.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ success: false, message: "获取用户失败", error: err.message });
  }
};

// ─── EMPLOYEE: SEND VERIFICATION CODE ───────────────────────────────────────
export const sendEmployeeVerificationCode = async (req, res) => {
  try {
    const phone = trimValue(req.body?.phone_number);
    if (!phone)
      return res.status(400).json({ success: false, message: "手机号不能为空" });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Store temporarily keyed by phone in a temp document
    // We use a partial User doc (no auth yet) just to hold the code
    await User.findOneAndUpdate(
      { phone_number: phone, role: "employee", phone_verified: false },
      {
        phone_verification_code: code,
        phone_verification_expires: expires,
      },
      { upsert: false }
    );

    // For DEV MODE: return the code directly
    return res.status(200).json({
      success: true,
      message: "验证码已发送（开发模式）",
      dev_code: code, // REMOVE IN PRODUCTION
      expires_at: expires,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "发送验证码失败", error: err.message });
  }
};

// ─── EMPLOYEE REGISTER (Step 1 + 2 combined — send code then register) ──────
// Step 1: POST /auth/employee/send-code   { phone_number }
// Step 2: POST /auth/employee/register    { username, email, password, phone_number, code }

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

    // DEV MODE: accept any 6-digit code OR the stored code
    // In production you'd verify against stored code + expiry
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      // Production verification (add SMS logic here later)
      if (code.length !== 6)
        return res.status(400).json({ success: false, message: "验证码无效" });
    }

    const user = await User.create({
      username,
      email,
      password,
      phone_number,
      phone_verified: true,
      role: "employee",
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

// ─── EMPLOYEE LOGIN ──────────────────────────────────────────────────────────
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

// ─── SUPER ADMIN LOGIN ───────────────────────────────────────────────────────
export const superAdminLogin = async (req, res) => {
  try {
    const email = trimValue(req.body?.email).toLowerCase();
    const password = trimValue(req.body?.password);

    const SA_EMAIL = "superadmin@futuristicgamingproject";
    const SA_PASS = "AdminPanel@@FuturisticGaming";

    if (email !== SA_EMAIL || password !== SA_PASS)
      return res.status(401).json({ success: false, message: "超管凭据错误" });

    // Find or create super admin account
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
  } catch (err) {
    return res.status(500).json({ success: false, message: "超管登录失败", error: err.message });
  }
};
