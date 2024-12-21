"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";

// Clerk Hooks
import { useSignIn, useSignUp, useAuth, useClerk } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- 登录用 schema
const loginSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

// --- 注册用: 在 loginSchema 基础上多了 confirmPassword
const registerSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  // 表示是否需要用户输入验证码来验证邮箱
  const [emailCodeStep, setEmailCodeStep] = useState<"none" | "needed" | "done">("none");
  const [emailCode, setEmailCode] = useState(""); // 存储用户输入的验证码

  // 表示用户是否需要完成 CAPTCHA
  const [captchaStep, setCaptchaStep] = useState<"none" | "needed" | "done">("none");

  // Clerk Hooks
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { isLoaded: authLoaded } = useAuth();
  const clerk = useClerk();

  // Hook Form: login
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Hook Form: register
  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  /**
   * 主流程：邮箱+密码的登录 / 注册
   */
  const handleCredentials = async (
    data: z.infer<typeof loginSchema> | z.infer<typeof registerSchema>
  ) => {
    console.log(`=== handleCredentials [mode=${mode}] start ===`);
    console.log("Received form data:", data);

    setIsLoading(true);
    setCaptchaStep("none"); // 重置 captcha
    setEmailCodeStep("none"); // 重置 email code

    try {
      // 确保 Clerk Hooks 加载完毕
      if (!signInLoaded || !signUpLoaded || !authLoaded) {
        throw new Error("Clerk not fully loaded.");
      }
      console.log("Clerk hooks loaded. Proceeding...");

      if (mode === "login") {
        // ----------------------
        // 登录
        // ----------------------
        console.log("Calling signIn.create() with:", data.email, data.password);
        const result = await signIn.create({
          identifier: data.email,
          password: data.password,
        });
        console.log("signIn.create() returned:", JSON.stringify(result, null, 2));

        if (result.status === "complete") {
          console.log("Login result is 'complete'. Setting active session...");
          await clerk.setActive({ session: result.createdSessionId });
          console.log("Session setActive done. User is logged in!");
        } else {
          console.warn("Login result not 'complete'. status =", result.status);
          loginForm.setError("root", { message: "Invalid credentials" });
        }
      } else {
        // ----------------------
        // 注册
        // ----------------------
        console.log("Calling signUp.create() with:", data.email, data.password);
        const result = await signUp.create({
          emailAddress: data.email,
          password: data.password,
        });
        console.log("signUp.create() returned:", JSON.stringify(result, null, 2));
        console.log("Current signUp status =", result.status);

        if (result.status === "complete") {
          // 注册已全部完成
          console.log("Sign-up status is 'complete'. Setting active session...");
          await clerk.setActive({ session: result.createdSessionId });
          console.log("Session setActive done. Registration success!");
        }
      
        else if (result.status === "missing_requirements") {
          // 如果 unverifiedFields 包含 "email_address"，说明要验证邮箱
          if (result.unverifiedFields?.includes("email_address")) {
            console.log("[Email Verification] Sending code to user's email...");
            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            console.log("[Email Verification] Clerk has sent a code to user's email.");
            setEmailCodeStep("needed");

            // 给一个表单错误提示
            registerForm.setError("root", {
              message: "Registration pending. A code was sent to your email; please enter it below.",
            });
          } else {
            // 可能还有其他 missingRequirements
            registerForm.setError("root", { message: "Registration requires more steps." });
          }
        }
        else {
          console.warn("Registration result not 'complete', 'needs_captcha_verification', or 'missing_requirements'.");
          console.log("Possible status:", result.status, "Check for other verifications needed.");
          registerForm.setError("root", { message: "Registration failed" });
        }
      }
    } catch (err: any) {
      console.error(`[LoginForm] Error during ${mode}:`, err);
      console.log("Error details (stringified):", JSON.stringify(err, null, 2));

      const errorMsg = `An error occurred during ${mode}`;
      if (mode === "login") {
        loginForm.setError("root", { message: errorMsg });
      } else {
        registerForm.setError("root", { message: errorMsg });
      }
    } finally {
      setIsLoading(false);
      console.log(`=== handleCredentials [mode=${mode}] end ===`);
    }
  };

  /**
   * 用户完成可见Captcha后，再调用 attemptCaptchaVerification
   */
  const handleCompleteCaptcha = async () => {
    console.log("=== handleCompleteCaptcha ===");
    setIsLoading(true);

    try {
      console.log("Calling signUp.attemptCaptchaVerification()...");
      const attemptRes = await signUp.attemptCaptchaVerification();
      console.log("attemptCaptchaVerification returned:", JSON.stringify(attemptRes, null, 2));

      if (attemptRes.status === "complete") {
        console.log("[CAPTCHA] Captcha verified => Registration success. Setting session...");
        await clerk.setActive({ session: attemptRes.createdSessionId });
        console.log("Session setActive done!");
        setCaptchaStep("done");
      } else {
        console.warn("attemptCaptchaVerification => status:", attemptRes.status);
        registerForm.setError("root", {
          message: "Registration failed: captcha invalid or more steps needed",
        });
      }
    } catch (err) {
      console.error("[CAPTCHA] Error attempting captcha verification:", err);
      console.log("Error details (stringified):", JSON.stringify(err, null, 2));
      registerForm.setError("root", {
        message: "Captcha verification failed, please try again",
      });
    } finally {
      setIsLoading(false);
      console.log("=== handleCompleteCaptcha end ===");
    }
  };

  /**
   * 用户输入邮箱验证码后，调用 attemptEmailAddressVerification({ code }) 来验证
   */
  const handleVerifyEmailCode = async () => {
    console.log("=== handleVerifyEmailCode ===");
    setIsLoading(true);
    try {
      console.log("Calling signUp.attemptEmailAddressVerification() with code =", emailCode);
      const verifyRes = await signUp.attemptEmailAddressVerification({
        code: emailCode,
      });
      console.log("attemptEmailAddressVerification returned:", JSON.stringify(verifyRes, null, 2));

      if (verifyRes.status === "complete") {
        console.log("[EmailCode] Email verified => Registration success. Setting session...");
        await clerk.setActive({ session: verifyRes.createdSessionId });
        console.log("Session setActive done!");
        setEmailCodeStep("done");
      } else {
        console.warn("attemptEmailAddressVerification => status:", verifyRes.status);
        registerForm.setError("root", {
          message: "Verification failed. Code incorrect or more steps required.",
        });
      }
    } catch (err) {
      console.error("[EmailCode] Error verifying email code:", err);
      registerForm.setError("root", {
        message: "Email code verification failed, please try again",
      });
    } finally {
      setIsLoading(false);
      console.log("=== handleVerifyEmailCode end ===");
    }
  };

  /**
   * 保留 Google 登录
   */
  const handleGoogleSignIn = async () => {
    console.log("=== handleGoogleSignIn ===");
    setIsLoading(true);
    try {
      if (!signInLoaded) {
        throw new Error("signIn not loaded yet");
      }
      console.log("Calling signIn.authenticateWithRedirect({ oauth_google })");
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: window.location.origin,
        redirectUrlComplete: window.location.origin,
      });
    } catch (err) {
      console.error("Google Sign-In failed", err);
      setIsLoading(false);
    } finally {
      console.log("=== handleGoogleSignIn end ===");
    }
  };

  return (
    <Card className="mx-auto max-w-max custom-shadow select-none">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome</CardTitle>
        <CardDescription>
          Login or register to sync across devices and unlock more models
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Tabs 切换 登录 / 注册 */}
        <Tabs
          defaultValue="login"
          className="w-full"
          onValueChange={(value) => {
            setMode(value as "login" | "register");
            registerForm.clearErrors("root");
            loginForm.clearErrors("root");
            setCaptchaStep("none");
            setEmailCodeStep("none");
            setEmailCode("");
            console.log(`Switched to tab: ${value}`);
          }}
        >
          <TabsList className="grid w-full grid-cols-2 space-x-1">
            <TabsTrigger
              className="transition-scale-zoom hover:bg-secondary hover:custom-shadow"
              value="login"
            >
              Login
            </TabsTrigger>
            <TabsTrigger
              className="transition-scale-zoom hover:bg-secondary hover:custom-shadow"
              value="register"
            >
              Register
            </TabsTrigger>
          </TabsList>

          {/* 登录表单 */}
          <TabsContent value="login">
            <Form {...loginForm}>
              <form
                onSubmit={loginForm.handleSubmit(handleCredentials)}
                className="grid gap-4"
              >
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {loginForm.formState.errors.root && (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.root.message}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* 注册表单 */}
          <TabsContent value="register">
            {/* Clerk 会将验证码插入此容器 */}
            <div id="clerk-captcha" className="my-2" />

            <Form {...registerForm}>
              <form
                onSubmit={registerForm.handleSubmit(handleCredentials)}
                className="grid gap-4"
              >
                <FormField
                  control={registerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          disabled={isLoading || captchaStep === "needed"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          disabled={isLoading || captchaStep === "needed"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="********"
                          disabled={isLoading || captchaStep === "needed"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {registerForm.formState.errors.root && (
                  <p className="text-sm text-destructive">
                    {registerForm.formState.errors.root.message}
                  </p>
                )}

                {/* 如果还没到captcha环节，就显示"Register"按钮； 如果Captcha环节，需要新的"Complete Captcha"按钮 */}
                {captchaStep === "needed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading}
                    onClick={handleCompleteCaptcha}
                  >
                    {isLoading ? "Verifying captcha..." : "Complete Captcha"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Registering..." : "Register"}
                  </Button>
                )}
              </form>
            </Form>

            {/** 如果需要用户输入邮箱验证码 **/}
            {emailCodeStep === "needed" && (
              <div className="mt-4 space-y-2">
                <p className="text-sm">
                  A code was sent to your email. Please enter it below to verify:
                </p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Enter 6-digit code"
                    disabled={isLoading}
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={isLoading || !emailCode}
                    onClick={handleVerifyEmailCode}
                  >
                    {isLoading ? "Verifying..." : "Verify Email Code"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="flex flex-col gap-4">
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google 登录按钮 */}
        <Button
          variant="outline"
          className="w-full h-fit whitespace-break-spaces"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92
                 c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57
                 c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23
                 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99
                 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43
                 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45
                 2.09 14.97 1 12 1 7.7 1 3.99 3.47
                 2.18 7.07l3.66 2.84c.87-2.6
                 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </CardFooter>
    </Card>
  );
}
