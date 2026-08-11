import { RegisterForm } from "./register-form";

// 注册页：服务端组件渲染注册表单。
// 真实提交流程（csrfFetch → /api/auth/register → 自动登录 → 跳转）在 Step 5 接线。
export default function RegisterPage() {
  return <RegisterForm />;
}
