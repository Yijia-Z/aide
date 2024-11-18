// components/LoginModal.tsx
"use client";

import React, { useState } from "react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (userData: { username: string; email: string }) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [signUpData, setSignUpData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLoginChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleSignUpChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSignUpData({ ...signUpData, [e.target.name]: e.target.value });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("http://localhost:8000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      const data = await response.json();

      if (response.ok) {
        const { access_token, token_type } = data;
        localStorage.setItem("access_token", access_token);
        setMessage("Login successful!");
        onClose();
        // Fetch user information
        const userInfoResponse = await fetch(
          "http://localhost:8000/api/userinfo",
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        );
        if (userInfoResponse.ok) {
          const userData = await userInfoResponse.json();
          onLoginSuccess({
            username: userData.username,
            email: userData.email,
          });
        }
      } else {
        setError(data.detail || "Login failed, please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signUpData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Registration successful! You can now log in.");
        setIsSignUp(false);
      } else {
        setError(data.detail || "Registration failed, please try again.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An error occurred during registration, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg w-11/12 max-w-md p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          &times;
        </button>
        {!isSignUp ? (
          <>
            <h2 className="text-2xl mb-4 text-center">Login</h2>
            <form onSubmit={handleLoginSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={loginData.email}
                  onChange={handleLoginChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter your email"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <p className="text-red-500 mb-4 text-center">{error}</p>
              )}
              {message && (
                <p className="text-green-500 mb-4 text-center">{message}</p>
              )}
              <button
                type="submit"
                className={`w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
            <p className="mt-4 text-center">
              Don't have an account?{" "}
              <button
                className="text-blue-500 hover:underline"
                onClick={() => {
                  setIsSignUp(true);
                  setError(null);
                  setMessage(null);
                }}
              >
                Click to Register
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl mb-4 text-center">Register</h2>
            <form onSubmit={handleSignUpSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700">Username</label>
                <input
                  type="text"
                  name="username"
                  value={signUpData.username}
                  onChange={handleSignUpChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter your username"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={signUpData.email}
                  onChange={handleSignUpChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter your email"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700">Password</label>
                <input
                  type="password"
                  name="password"
                  value={signUpData.password}
                  onChange={handleSignUpChange}
                  required
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <p className="text-red-500 mb-4 text-center">{error}</p>
              )}
              {message && (
                <p className="text-green-500 mb-4 text-center">{message}</p>
              )}
              <button
                type="submit"
                className={`w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                {loading ? "Registering..." : "Register"}
              </button>
            </form>
            <p className="mt-4 text-center">
              Already have an account?{" "}
              <button
                className="text-blue-500 hover:underline"
                onClick={() => {
                  setIsSignUp(false);
                  setError(null);
                  setMessage(null);
                }}
              >
                Back to Login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
