import ContactSubmission from "../models/ContactSubmission.js";

const VALID_STATUSES = ["new", "read", "replied"];
const trimValue = (v) => (typeof v === "string" ? v.trim() : "");
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const createContactSubmission = async (req, res) => {
  try {
    const name = trimValue(req.body?.name);
    const email = trimValue(req.body?.email).toLowerCase();
    const message = trimValue(req.body?.message);
    const errors = {};

    if (!name) errors.name = "请输入姓名";
    if (!email) errors.email = "请输入电子邮箱";
    else if (!isValidEmail(email)) errors.email = "请输入有效的电子邮箱地址";
    if (!message) errors.message = "请输入留言内容";

    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: "表单验证失败", errors });

    const submission = await ContactSubmission.create({ name, email, message });

    return res.status(201).json({ success: true, message: "消息提交成功", data: submission });
  } catch (err) {
    return res.status(500).json({ success: false, message: "服务器错误", error: err.message });
  }
};

export const getContactSubmissions = async (req, res) => {
  try {
    const submissions = await ContactSubmission.find().sort({ created_at: -1 });
    return res.status(200).json({ success: true, data: submissions });
  } catch (err) {
    return res.status(500).json({ success: false, message: "获取联系消息失败", error: err.message });
  }
};

export const updateContactSubmissionStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = trimValue(req.body?.status);

    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({ success: false, message: "无效状态" });

    const submission = await ContactSubmission.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!submission)
      return res.status(404).json({ success: false, message: "记录不存在" });

    return res.status(200).json({ success: true, message: "状态更新成功", data: submission });
  } catch (err) {
    return res.status(500).json({ success: false, message: "服务器错误", error: err.message });
  }
};

export const deleteContactSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const submission = await ContactSubmission.findByIdAndDelete(id);

    if (!submission)
      return res.status(404).json({ success: false, message: "记录不存在" });

    return res.status(200).json({ success: true, message: "消息删除成功" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "服务器错误", error: err.message });
  }
};
