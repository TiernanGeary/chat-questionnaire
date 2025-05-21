"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { CheckCircle, Calendar, Phone } from "lucide-react"

export default function ResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [estimatedSavings, setEstimatedSavings] = useState<number>(0)

  // Get data from URL params (in a real app, you'd likely use a more robust state management solution)
  const postalCode = searchParams.get("postalCode")
  const address = searchParams.get("address")
  const electricityBill = searchParams.get("electricityBill")
  const housingType = searchParams.get("housingType")
  const name = searchParams.get("name")
  const phone = searchParams.get("phone")

  useEffect(() => {
    // Simulate loading and calculation
    const timer = setTimeout(() => {
      // Calculate estimated savings based on electricity bill
      // This is just a simple example calculation
      let savings = 0
      if (electricityBill === "20,000円以上") {
        savings = Math.floor(Math.random() * 10000) + 10000
      } else if (electricityBill === "15,000円〜19,999円") {
        savings = Math.floor(Math.random() * 5000) + 7500
      } else if (electricityBill === "10,000円〜14,999円") {
        savings = Math.floor(Math.random() * 3000) + 5000
      } else {
        savings = Math.floor(Math.random() * 2000) + 3000
      }

      setEstimatedSavings(savings)
      setLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [electricityBill])

  const handleBackToHome = () => {
    router.push("/")
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background SVG */}
      <div className="absolute inset-0 w-full h-full z-0">
        <img src="/images/asset-14.svg" alt="Background" className="w-full h-full object-cover" />
      </div>

      {/* Company logo in a white header section */}
      <div className="w-full bg-white shadow-sm z-10 relative">
        <div className="max-w-7xl mx-auto flex justify-center py-3">
          <img src="/images/company-logo.png" alt="SOLA CLOUD" className="h-12 w-auto" />
        </div>
      </div>

      {/* Content area */}
      <div className="w-full relative z-10 flex-grow">
        <div className="pt-8 pb-12 md:pb-24 px-4">
          <div className="w-full max-w-2xl mx-auto">
            <Card className="w-full bg-white shadow-lg rounded-xl overflow-hidden">
              <div className="p-4 flex justify-center items-center border-b border-gray-100">
                <img src="/images/asset-15.svg" alt="Magnifying Glass" className="h-8 w-8 mr-2" />
                <h1 className="text-2xl font-bold" style={{ color: "#3283FF" }}>
                  診断完了！
                </h1>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div
                      className="w-16 h-16 border-4 border-t-4 border-gray-200 rounded-full animate-spin"
                      style={{ borderTopColor: "#66B1F9" }}
                    ></div>
                    <p className="mt-4 text-lg" style={{ color: "#68584B" }}>
                      診断結果を計算中...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center">
                      <CheckCircle className="h-16 w-16 text-green-500 mr-4" />
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: "#68584B" }}>
                          診断が完了しました！
                        </h2>
                        <p className="text-gray-600">{name || "お客様"}様、ご回答ありがとうございました。</p>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="text-lg font-bold mb-2" style={{ color: "#68584B" }}>
                        あなたの推定電気代削減額
                      </h3>
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm text-gray-600">毎月の削減額</p>
                          <p className="text-4xl font-bold text-green-600">¥{estimatedSavings.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">年間 ¥{(estimatedSavings * 12).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <h3 className="text-lg font-bold mb-3" style={{ color: "#68584B" }}>
                        お客様情報
                      </h3>
                      <div className="space-y-2">
                        <p>
                          <span className="font-medium">お名前:</span> {name || "未入力"}
                        </p>
                        <p>
                          <span className="font-medium">電話番号:</span> {phone || "未入力"}
                        </p>
                        <p>
                          <span className="font-medium">郵便番号:</span> {postalCode || "未入力"}
                        </p>
                        <p>
                          <span className="font-medium">住所:</span> {address || "未入力"}
                        </p>
                        <p>
                          <span className="font-medium">住宅タイプ:</span> {housingType || "未入力"}
                        </p>
                        <p>
                          <span className="font-medium">現在の電気代:</span> {electricityBill || "未入力"}
                        </p>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="text-lg font-bold mb-2" style={{ color: "#68584B" }}>
                        次のステップ
                      </h3>
                      <p className="mb-4">
                        より詳細な診断と最適なプランのご提案のため、専門のアドバイザーがご連絡いたします。
                      </p>
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center">
                          <Calendar className="h-5 w-5 text-blue-500 mr-2" />
                          <span>3営業日以内にご連絡いたします</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 text-blue-500 mr-2" />
                          <span>登録された電話番号にお電話します</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center pt-4">
                      <button
                        className="relative h-[70px] w-[250px] font-bold hover:opacity-90 transition-opacity"
                        onClick={handleBackToHome}
                      >
                        <img src="/images/asset-13.png" alt="" className="w-full h-full absolute inset-0" />
                        <span className="relative z-10 px-4 text-center" style={{ color: "#FFFA5A" }}>
                          トップページに戻る
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer section - smaller size */}
      <footer style={{ backgroundColor: "#828282" }} className="w-full py-3 mt-auto z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-center space-x-6 mb-1">
            <a href="#" className="text-white text-xs hover:underline">
              運営会社
            </a>
            <a href="#" className="text-white text-xs hover:underline">
              利用規約
            </a>
            <a href="#" className="text-white text-xs hover:underline">
              プライバシーポリシー
            </a>
          </div>
          <div className="text-center text-white text-[10px]">©SOLA CLOUD All rights reserved.</div>
        </div>
      </footer>
    </div>
  )
}
