import Order from "../models/Order.js";
import { getIO } from "../socket.js";

export const createOrder = async (req, res) => {
  try {
    const { items, total, game, service_type, payment_method, coupon_code } = req.body;

    const order = await Order.create({
      client_id: req.user._id,
      items: items || [],
      total: Number(total) || 0,
      game: game || "",
      service_type: service_type || "",
      payment_method,
      coupon_code,
    });

    const io = getIO();
    if (io) io.emit("new_order", order);

    return res.status(201).json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ client_id: req.user._id }).sort({ created_at: -1 });
    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: "订单不存在" });
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Super admin: get all orders
export const getAllOrders = async (req, res) => {
  try {
    const { status, employee_id, client_id } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (employee_id) filter.employee_id = employee_id;
    if (client_id) filter.client_id = client_id;

    const orders = await Order.find(filter)
      .populate("client_id", "username email")
      .populate("employee_id", "username email")
      .sort({ created_at: -1 });

    return res.json({ success: true, data: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
