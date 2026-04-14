import Order from "../models/Order.js";
import ServicePost from "../models/ServicePost.js";
import User from "../models/User.js";
import { getIO } from "../socket.js";

// ─── GET AVAILABLE (PENDING) ORDERS ─────────────────────────────────────────
export const getAvailableOrders = async (req, res) => {
  try {
    const { game, service_type, min_price, max_price } = req.query;
    const filter = { status: "pending" };

    if (game) filter.game = { $regex: game, $options: "i" };
    if (service_type) filter.service_type = { $regex: service_type, $options: "i" };
    if (min_price || max_price) {
      filter.total = {};
      if (min_price) filter.total.$gte = Number(min_price);
      if (max_price) filter.total.$lte = Number(max_price);
    }

    const orders = await Order.find(filter).sort({ created_at: -1 });

    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET MY (EMPLOYEE'S ACCEPTED) ORDERS ────────────────────────────────────
export const getMyEmployeeOrders = async (req, res) => {
  try {
    const orders = await Order.find({ employee_id: req.user._id }).sort({ created_at: -1 });
    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ACCEPT ORDER ────────────────────────────────────────────────────────────
export const acceptOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "confirmed", employee_id: req.user._id },
      { new: true }
    );

    if (!order)
      return res.status(400).json({ success: false, message: "订单已被接取或不存在" });

    const io = getIO();
    if (io) io.emit("order_updated", order);

    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ORDER STATUS ─────────────────────────────────────────────────────
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress_note } = req.body;

    const allowed = ["in_progress", "completed", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ success: false, message: "无效的状态值" });

    const order = await Order.findOneAndUpdate(
      { _id: id, employee_id: req.user._id },
      { status, progress_note },
      { new: true }
    );

    if (!order)
      return res.status(400).json({ success: false, message: "更新失败，权限不足或订单不存在" });

    const io = getIO();
    if (io) io.emit("order_updated", order);

    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET EMPLOYEE STATS ───────────────────────────────────────────────────────
export const getEmployeeStats = async (req, res) => {
  try {
    const empId = req.user._id;

    const [totalOrders, completedOrders, activeOrders, todayOrders] = await Promise.all([
      Order.countDocuments({ employee_id: empId }),
      Order.countDocuments({ employee_id: empId, status: "completed" }),
      Order.countDocuments({ employee_id: empId, status: { $in: ["confirmed", "in_progress"] } }),
      Order.countDocuments({
        employee_id: empId,
        created_at: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    const completionRate =
      totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    const completedWithTotal = await Order.find({
      employee_id: empId,
      status: "completed",
    });
    const totalEarnings = completedWithTotal.reduce((s, o) => s + (o.total || 0), 0);

    return res.json({
      success: true,
      data: {
        today_orders: todayOrders,
        total_earnings: totalEarnings,
        completion_rate: completionRate,
        active_orders: activeOrders,
        total_orders: totalOrders,
        completed_orders: completedOrders,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── TOGGLE ONLINE STATUS ─────────────────────────────────────────────────────
export const toggleOnlineStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.is_online = !user.is_online;
    await user.save();

    return res.json({ success: true, is_online: user.is_online });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── SERVICE POSTS ────────────────────────────────────────────────────────────
export const createServicePost = async (req, res) => {
  try {
    const { title, description, image, price, category, tags } = req.body;

    if (!title || !price)
      return res.status(400).json({ success: false, message: "标题和价格为必填项" });

    const post = await ServicePost.create({
      employee_id: req.user._id,
      title,
      description,
      image,
      price: Number(price),
      category: category || "general",
      tags: Array.isArray(tags) ? tags : [],
    });

    return res.status(201).json({ success: true, message: "服务发布成功", data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyServicePosts = async (req, res) => {
  try {
    const posts = await ServicePost.find({ employee_id: req.user._id }).sort({ created_at: -1 });
    return res.json({ success: true, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateServicePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await ServicePost.findOneAndUpdate(
      { _id: id, employee_id: req.user._id },
      req.body,
      { new: true }
    );
    if (!post)
      return res.status(404).json({ success: false, message: "帖子不存在或无权限" });
    return res.json({ success: true, data: post });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteServicePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await ServicePost.findOneAndDelete({ _id: id, employee_id: req.user._id });
    if (!post)
      return res.status(404).json({ success: false, message: "帖子不存在或无权限" });
    return res.json({ success: true, message: "帖子已删除" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUBLIC: GET ALL ACTIVE SERVICE POSTS (for homepage) ─────────────────────
export const getAllActiveServicePosts = async (req, res) => {
  try {
    const posts = await ServicePost.find({ status: "active" })
      .populate("employee_id", "username avatar")
      .sort({ created_at: -1 });
    return res.json({ success: true, data: posts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
