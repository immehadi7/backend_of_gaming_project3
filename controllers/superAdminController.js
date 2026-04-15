import User from "../models/User.js";
import Order from "../models/Order.js";
import ServicePost from "../models/ServicePost.js";
import ContactSubmission from "../models/ContactSubmission.js";
import bcrypt from "bcryptjs";

// ─── DASHBOARD STATS ─────────────────────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    const [totalOrders, todayOrders, totalUsers, activeUsers, onlineEmployees, totalRevenue] =
      await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ created_at: { $gte: todayStart } }),
        User.countDocuments({ role: { $in: ["client", "employee"] } }),
        User.countDocuments({ is_active: true }),
        User.countDocuments({ role: "employee", is_online: true }),
        Order.aggregate([
          { $match: { status: "completed" } },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
      ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const orderTrend = await Order.aggregate([
      { $match: { created_at: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.json({
      success: true,
      data: {
        total_orders: totalOrders,
        today_orders: todayOrders,
        total_revenue: totalRevenue[0]?.total || 0,
        active_users: activeUsers,
        total_users: totalUsers,
        online_employees: onlineEmployees,
        order_trend: orderTrend,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────
export const getAllUsers = async (req, res) => {
  try {
    const { role, search, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status === "active") filter.is_active = true;
    if (status === "banned") filter.is_active = false;
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const users = await User.find(filter)
      .select("-password -phone_verification_code")
      .sort({ created_at: -1 });
    return res.json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const banUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { is_active: false }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
    return res.json({ success: true, message: "用户已禁用", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const unbanUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { is_active: true }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
    return res.json({ success: true, message: "用户已启用", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
    if (user.role === "super_admin")
      return res.status(403).json({ success: false, message: "不能删除超级管理员" });
    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "用户已删除" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const allowed = ["client", "employee", "admin"];
    if (!allowed.includes(role))
      return res.status(400).json({ success: false, message: "无效角色" });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ success: false, message: "用户不存在" });
    return res.json({ success: true, message: "角色已更新", data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── EMPLOYEE MANAGEMENT ──────────────────────────────────────────────────────
export const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: "employee" })
      .select("-password -phone_verification_code")
      .sort({ created_at: -1 });

    const enriched = await Promise.all(
      employees.map(async (emp) => {
        const [assigned, completed] = await Promise.all([
          Order.countDocuments({ employee_id: emp._id }),
          Order.countDocuments({ employee_id: emp._id, status: "completed" }),
        ]);
        return { ...emp.toObject(), assigned_orders: assigned, completed_orders: completed };
      })
    );
    return res.json({ success: true, data: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createEmployeeAccount = async (req, res) => {
  try {
    const { username, email, password, phone_number } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: "用户名、邮箱和密码为必填项" });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ success: false, message: "该邮箱已被注册" });
    const employee = await User.create({
      username, email: email.toLowerCase(), password,
      phone_number: phone_number || "", phone_verified: true, role: "employee",
    });
    return res.status(201).json({ success: true, message: "员工账号已创建", data: employee.toSafeObject() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ADMIN ACCOUNT MANAGEMENT ─────────────────────────────────────────────────
// Super Admin can create new admin accounts (role = "admin")
// These admins can also log in via the 👑 管理 tab in AuthModal

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: { $in: ["admin", "super_admin"] } })
      .select("-password -phone_verification_code")
      .sort({ created_at: -1 });
    return res.json({ success: true, data: admins });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createAdminAccount = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ success: false, message: "用户名、邮箱和密码为必填项" });

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, message: "邮箱格式无效" });

    if (password.length < 6)
      return res.status(400).json({ success: false, message: "密码至少需要6位" });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ success: false, message: "该邮箱已被注册" });

    const admin = await User.create({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password, // hashed by User model pre-save hook
      role: "admin",
      phone_verified: true,
      is_active: true,
    });

    return res.status(201).json({
      success: true,
      message: `管理员账号 "${username}" 创建成功`,
      data: admin.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteAdminAccount = async (req, res) => {
  try {
    const admin = await User.findById(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: "账号不存在" });
    if (admin.role === "super_admin")
      return res.status(403).json({ success: false, message: "不能删除超级管理员" });
    await User.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: "管理员账号已删除" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const resetAdminPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6)
      return res.status(400).json({ success: false, message: "新密码至少需要6位" });

    const admin = await User.findById(req.params.id).select("+password");
    if (!admin) return res.status(404).json({ success: false, message: "账号不存在" });
    if (admin.role === "super_admin")
      return res.status(403).json({ success: false, message: "不能重置超级管理员密码" });

    admin.password = new_password; // pre-save hook will hash it
    await admin.save();

    return res.json({ success: true, message: "密码已重置" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ORDER MANAGEMENT ────────────────────────────────────────────────────────
export const adminGetAllOrders = async (req, res) => {
  try {
    const { status, employee_id, client_id, from_date, to_date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (employee_id) filter.employee_id = employee_id;
    if (client_id) filter.client_id = client_id;
    if (from_date || to_date) {
      filter.created_at = {};
      if (from_date) filter.created_at.$gte = new Date(from_date);
      if (to_date) filter.created_at.$lte = new Date(to_date);
    }
    const orders = await Order.find(filter)
      .populate("client_id", "username email")
      .populate("employee_id", "username email")
      .sort({ created_at: -1 });
    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, employee_id } = req.body;
    const update = { status };
    if (employee_id) update.employee_id = employee_id;
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("client_id", "username email")
      .populate("employee_id", "username email");
    if (!order) return res.status(404).json({ success: false, message: "订单不存在" });
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const adminDeleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "订单不存在" });
    return res.json({ success: true, message: "订单已删除" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CONTACT MESSAGES ────────────────────────────────────────────────────────
export const adminGetContactMessages = async (req, res) => {
  try {
    const messages = await ContactSubmission.find().sort({ created_at: -1 });
    return res.json({ success: true, data: messages });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── REPORTS ─────────────────────────────────────────────────────────────────
export const getRevenueReport = async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    const format = period === "daily" ? "%Y-%m-%d" : "%Y-%m";
    const report = await Order.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: { $dateToString: { format, date: "$created_at" } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getUserGrowthReport = async (req, res) => {
  try {
    const report = await User.aggregate([
      { $match: { role: { $in: ["client", "employee"] } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
