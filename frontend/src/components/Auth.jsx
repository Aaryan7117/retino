import { useState } from "react"
import { login, signUp } from "../utils/auth"

export default function Auth() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await signUp(email, password)
      }
    } catch (err) {
      alert(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent blur-3xl pointer-events-none"></div>

      {/* Card */}
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-8">
        
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-white">
            RetinaScan <span className="text-blue-400">AI</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isLogin ? "Login to continue" : "Create your account"}
          </p>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold py-2 rounded-lg shadow-lg shadow-blue-900/40"
        >
          {loading ? "Please wait..." : isLogin ? "Login" : "Sign Up"}
        </button>

        {/* Toggle */}
        <p className="text-sm text-slate-400 text-center mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <span
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 cursor-pointer ml-1 hover:underline"
          >
            {isLogin ? "Sign Up" : "Login"}
          </span>
        </p>
      </div>
    </div>
  )
}