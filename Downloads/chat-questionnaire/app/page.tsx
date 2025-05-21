"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { RefreshCw, Upload } from "lucide-react"

// Define the structure for our chat messages
type MessageType = "agent" | "user" | "options" | "annotation" | "supplementary"
type InputType = "button" | "text" | "file" | "radio" | "none"

interface Message {
  id: number
  type: MessageType
  content: string
  inputType?: InputType
  options?: string[]
  annotation?: string
  supplementary?: string
  additionalContent?: string
  validation?: (value: string) => boolean
  color?: string
  autoFill?: boolean
  buttonTextColor?: string
}

// Define our questionnaire flow
const questionnaireFlow: Message[] = [
  {
    id: 1,
    type: "agent",
    content: "毎月の電気代を教えてください",
    inputType: "button",
    options: ["20,000円以上", "15,000円〜19,999円", "10,000円〜14,999円", "9,999円以下"],
  },
  {
    id: 2,
    type: "agent",
    content: "住宅について教えてください",
    inputType: "button",
    annotation: "月々の電気代を大幅に削減、または0円になる可能性があります！",
    options: ["平屋", "２階建て", "２世帯住宅", "狭小住宅", "その他"],
  },
  {
    id: 3,
    type: "agent",
    content: "設置場所の郵便番号を教えてください",
    inputType: "text",
    validation: (value: string) => {
      // Japanese postal code validation (XXX-XXXX or XXXXXXX)
      return /^\d{3}-?\d{4}$/.test(value)
    },
  },
  {
    id: 4,
    type: "agent",
    content: "続いて住所をご入力ください",
    inputType: "text",
    supplementary: "※正確な診断を実施するため番地までご記入ください",
    additionalContent: "販促物の送付や訪問による営業は一切ございませんのでご安心ください♪",
    autoFill: true,
  },
  {
    id: 5,
    type: "agent",
    content: "お家の図面をアップロードしてください",
    inputType: "file",
  },
  {
    id: 6,
    type: "agent",
    content: "現在太陽光・蓄電池は導入されていますか？",
    inputType: "radio",
    options: ["どちらも導入していない", "太陽光のみ導入している", "太陽光・蓄電池を導入している"],
  },
  {
    id: 7,
    type: "agent",
    content: "お名前を教えてください",
    inputType: "text",
  },
  {
    id: 8,
    type: "agent",
    content: "電話番号を教えてください",
    inputType: "text",
    validation: (value: string) => {
      // 11-digit phone number validation (no hyphens)
      return /^\d{11}$/.test(value)
    },
  },
  {
    id: 9,
    type: "agent",
    content: "電気代減額診断をする",
    inputType: "button",
    options: ["電気代減額診断をする"],
    color: "#FFFA5A",
  },
]

export default function Home() {
  const router = useRouter()
  const [activeMessages, setActiveMessages] = useState<Message[]>([])
  const [userResponses, setUserResponses] = useState<Record<number, string | File>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [inputValue, setInputValue] = useState("")
  const [isComplete, setIsComplete] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [autoFilledAddress, setAutoFilledAddress] = useState<string>("")
  const [selectedRadioOption, setSelectedRadioOption] = useState<string>("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add messages with a delay to simulate typing
  useEffect(() => {
    if (currentStep < questionnaireFlow.length && !isComplete) {
      const timer = setTimeout(() => {
        setActiveMessages((prev) => [...prev, questionnaireFlow[currentStep]])

        // Reset input values for new step
        setInputValue("")
        setValidationError(null)
        setSelectedFile(null)
        setSelectedRadioOption("")
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [currentStep, isComplete])

  const handleOptionSelect = (questionId: number, option: string) => {
    // Add user response to the chat
    setActiveMessages((prev) => [...prev, { id: Date.now(), type: "user", content: option }])

    // Store the response
    setUserResponses((prev) => ({
      ...prev,
      [questionId]: option,
    }))

    // If this is the last question, navigate to results page
    if (questionId === questionnaireFlow[questionnaireFlow.length - 1].id) {
      // Navigate to results page with query params
      const queryParams = new URLSearchParams()

      // Add all responses as query params
      Object.entries(userResponses).forEach(([id, value]) => {
        // Skip file uploads
        if (!(value instanceof File)) {
          const question = questionnaireFlow.find((q) => q.id === Number(id))
          if (question) {
            switch (question.id) {
              case 1: // Electricity bill
                queryParams.set("electricityBill", value as string)
                break
              case 2: // Housing type
                queryParams.set("housingType", value as string)
                break
              case 3: // Postal code
                queryParams.set("postalCode", value as string)
                break
              case 4: // Address
                queryParams.set("address", `${autoFilledAddress}${value as string}`)
                break
              case 7: // Name
                queryParams.set("name", value as string)
                break
              case 8: // Phone
                queryParams.set("phone", value as string)
                break
            }
          }
        }
      })

      // Add the final response
      if (questionId === 9) {
        queryParams.set("completed", "true")
      }

      // Navigate to results page
      router.push(`/results?${queryParams.toString()}`)
    } else {
      // Move to next question
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    // Check validation if applicable
    const currentQuestion = questionnaireFlow[currentStep]
    if (currentQuestion.validation && !currentQuestion.validation(inputValue)) {
      if (currentQuestion.id === 3) {
        setValidationError("正しい郵便番号形式で入力してください（例：123-4567）")
      } else if (currentQuestion.id === 8) {
        setValidationError("11桁の数字を入力してください（ハイフンなし）")
      } else {
        setValidationError("入力内容を確認してください")
      }
      return
    }

    // Clear validation error
    setValidationError(null)

    // Add user response to the chat
    setActiveMessages((prev) => [...prev, { id: Date.now(), type: "user", content: inputValue }])

    // Store the response
    setUserResponses((prev) => ({
      ...prev,
      [questionnaireFlow[currentStep].id]: inputValue,
    }))

    // If this is the postal code step and we need to auto-fill address
    if (currentQuestion.id === 3) {
      // In a real app, this would call an API to get the address
      // For this demo, we'll simulate it
      const postalCode = inputValue.replace(/-/g, "")
      if (postalCode.startsWith("100")) {
        setAutoFilledAddress("東京都千代田区")
      } else if (postalCode.startsWith("150")) {
        setAutoFilledAddress("東京都渋谷区")
      } else if (postalCode.startsWith("220")) {
        setAutoFilledAddress("神奈川県横浜市西区")
      } else {
        setAutoFilledAddress("東京都新宿区") // Default for demo
      }
    }

    setInputValue("")

    // Move to next question
    setCurrentStep((prev) => prev + 1)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      setSelectedFile(file)
    }
  }

  const handleFileSubmit = () => {
    if (!selectedFile) return

    // Add user response to the chat
    setActiveMessages((prev) => [
      ...prev,
      { id: Date.now(), type: "user", content: `ファイルをアップロードしました: ${selectedFile.name}` },
    ])

    // Store the response
    setUserResponses((prev) => ({
      ...prev,
      [questionnaireFlow[currentStep].id]: selectedFile,
    }))

    // Move to next question
    setCurrentStep((prev) => prev + 1)
  }

  const resetQuestionnaire = () => {
    setActiveMessages([])
    setUserResponses({})
    setCurrentStep(0)
    setIsComplete(false)
    setInputValue("")
    setValidationError(null)
    setSelectedFile(null)
    setAutoFilledAddress("")
    setSelectedRadioOption("")
  }

  // Helper function to organize options into rows of 2
  const organizeOptionsIntoRows = (options: string[]) => {
    const rows = []
    for (let i = 0; i < options.length; i += 2) {
      const row = options.slice(i, i + 2)
      rows.push(row)
    }
    return rows
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Company logo at the very top with no vertical padding */}
      <div className="w-full bg-white">
        <div className="max-w-7xl mx-auto flex justify-center">
          <img src="/images/company-logo.png" alt="SOLA CLOUD" className="h-12 w-auto" />
        </div>
      </div>

      {/* Top website header banner */}
      <div className="w-full">
        <img src="/images/header-banner.png" alt="Solar Panel Promotion" className="w-full h-auto" />
      </div>

      {/* Full width light blue background section */}
      <div className="w-full relative" style={{ backgroundColor: "#e6f2f3" }}>
        <div className="pt-0 pb-12 md:pb-24 px-4" style={{ marginTop: "-10px" }}>
          <div className="w-full max-w-2xl mx-auto">
            {/* Chat UI */}
            <Card className="w-full bg-white shadow-lg rounded-xl overflow-hidden">
              <div className="p-4 flex justify-center">
                <img src="/images/header-logo.svg" alt="Questionnaire Header" className="w-full h-auto" />
              </div>

              <div className="p-4 flex flex-col gap-3">
                {activeMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                    {message.type === "agent" && (
                      <div className="flex-shrink-0 mr-2">
                        <div className="relative">
                          <img
                            src="/images/operator.png"
                            alt="オペレーター"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col">
                      {message.type === "agent" && (
                        <span className="text-xs text-gray-500 mb-1 ml-1">オペレーター</span>
                      )}
                      <div
                        className={`${
                          message.type === "user" ? "whitespace-nowrap" : "max-w-[80%]"
                        } p-3 rounded-lg ${message.type === "user" ? "text-white rounded-br-none" : "rounded-bl-none"}`}
                        style={{
                          backgroundColor: message.type === "user" ? "#68584B" : "#E2F5EE",
                          color: message.type === "user" ? "white" : "#68584B",
                        }}
                      >
                        {message.content}

                        {/* Show annotation if available - now with pink text instead of background */}
                        {message.annotation && (
                          <div className="mt-2" style={{ color: message.color || "#F2739D" }}>
                            {message.annotation}
                          </div>
                        )}

                        {/* Show supplementary text if available */}
                        {message.supplementary && (
                          <div className="mt-2 text-xs text-gray-500">{message.supplementary}</div>
                        )}

                        {/* Show additional content if available */}
                        {message.additionalContent && <div className="mt-2">{message.additionalContent}</div>}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show options if available for the current step */}
                {currentStep < questionnaireFlow.length &&
                  activeMessages.some((m) => m.id === questionnaireFlow[currentStep].id) &&
                  questionnaireFlow[currentStep].inputType === "button" && (
                    <div className="my-4">
                      {/* Special handling for the final diagnostic button (question ID 9) */}
                      {questionnaireFlow[currentStep].id === 9 ? (
                        <div className="flex justify-center">
                          <button
                            className="relative h-[70px] w-[250px] font-bold hover:opacity-90 transition-opacity"
                            onClick={() =>
                              handleOptionSelect(
                                questionnaireFlow[currentStep].id,
                                questionnaireFlow[currentStep].options![0],
                              )
                            }
                          >
                            <img src="/images/asset-13.png" alt="" className="w-full h-full absolute inset-0" />
                            <span className="relative z-10 px-4 text-center" style={{ color: "#FFFA5A" }}>
                              {questionnaireFlow[currentStep].options![0]}
                            </span>
                          </button>
                        </div>
                      ) : (
                        // Organize options into rows of 2
                        <div className="flex flex-col gap-y-2">
                          {organizeOptionsIntoRows(questionnaireFlow[currentStep].options || []).map(
                            (row, rowIndex) => (
                              <div key={rowIndex} className="grid grid-cols-2 gap-x-2">
                                {row.map((option) => (
                                  <button
                                    key={option}
                                    className="relative h-[70px] font-bold hover:opacity-90 transition-opacity"
                                    onClick={() => handleOptionSelect(questionnaireFlow[currentStep].id, option)}
                                  >
                                    <img src="/images/asset-7.svg" alt="" className="w-full h-full absolute inset-0" />
                                    <span
                                      className="relative z-10 px-4 text-center"
                                      style={{
                                        color: "white",
                                      }}
                                    >
                                      {option}
                                    </span>
                                  </button>
                                ))}
                                {/* If there's only one option in the row, add an empty placeholder to maintain grid */}
                                {row.length === 1 && <div className="invisible"></div>}
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}

                {/* Show radio options as buttons with the asset-7.svg background */}
                {currentStep < questionnaireFlow.length &&
                  activeMessages.some((m) => m.id === questionnaireFlow[currentStep].id) &&
                  questionnaireFlow[currentStep].inputType === "radio" && (
                    <div className="flex flex-col gap-y-2 my-4">
                      {organizeOptionsIntoRows(questionnaireFlow[currentStep].options || []).map((row, rowIndex) => (
                        <div key={rowIndex} className="grid grid-cols-2 gap-x-2">
                          {row.map((option) => (
                            <button
                              key={option}
                              className="relative h-[70px] font-bold hover:opacity-90 transition-opacity"
                              onClick={() => handleOptionSelect(questionnaireFlow[currentStep].id, option)}
                            >
                              <img src="/images/asset-7.svg" alt="" className="w-full h-full absolute inset-0" />
                              <span className="relative z-10 px-4 text-center text-white">{option}</span>
                            </button>
                          ))}
                          {/* If there's only one option in the row, add an empty placeholder to maintain grid */}
                          {row.length === 1 && <div className="invisible"></div>}
                        </div>
                      ))}
                    </div>
                  )}

                {/* Show file upload if available for the current step */}
                {currentStep < questionnaireFlow.length &&
                  activeMessages.some((m) => m.id === questionnaireFlow[currentStep].id) &&
                  questionnaireFlow[currentStep].inputType === "file" && (
                    <div className="my-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex flex-col items-center">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept=".jpg,.jpeg,.png,.pdf,.heic"
                          className="hidden"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          variant="outline"
                          className="mb-2 w-full flex items-center justify-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          ファイルを選択
                        </Button>
                        {selectedFile && (
                          <div className="text-sm text-gray-600 mb-2">選択されたファイル: {selectedFile.name}</div>
                        )}
                        <Button
                          onClick={handleFileSubmit}
                          disabled={!selectedFile}
                          style={{ backgroundColor: "#68584B", color: "white" }}
                          className="w-full hover:opacity-90"
                        >
                          アップロード
                        </Button>
                      </div>
                    </div>
                  )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area for text input */}
              {currentStep < questionnaireFlow.length &&
                questionnaireFlow[currentStep].inputType === "text" &&
                activeMessages.some((m) => m.id === questionnaireFlow[currentStep].id) &&
                !isComplete && (
                  <form onSubmit={handleTextSubmit} className="p-4 border-t border-gray-200 flex flex-col gap-3">
                    {/* Auto-filled address field */}
                    {questionnaireFlow[currentStep].autoFill && autoFilledAddress && (
                      <div className="mb-2">
                        <input
                          type="text"
                          value={autoFilledAddress}
                          disabled
                          className="w-full p-2 border border-gray-300 rounded-md bg-gray-100"
                        />
                      </div>
                    )}

                    {/* Text input field - now full width */}
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={
                        questionnaireFlow[currentStep].id === 3
                          ? "例: 123-4567"
                          : questionnaireFlow[currentStep].id === 8
                            ? "例: 09012345678"
                            : "ここに回答を入力してください..."
                      }
                      className={`w-full p-2 border ${
                        validationError ? "border-red-500" : "border-gray-300"
                      } rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />

                    {/* Validation error message */}
                    {validationError && <div className="text-red-500 text-sm">{validationError}</div>}

                    {/* Submit button - now full width to match textbox */}
                    <button type="submit" className="relative w-full h-[70px] hover:opacity-90 transition-opacity">
                      <img src="/images/asset-8.svg" alt="送信" className="w-full h-full object-contain" />
                    </button>
                  </form>
                )}

              {/* Reset button when complete */}
              {isComplete && (
                <div className="p-4 border-t border-gray-200 flex justify-center">
                  <Button
                    onClick={resetQuestionnaire}
                    variant="outline"
                    className="flex gap-2"
                    style={{ borderColor: "#68584B", color: "#68584B" }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    最初からやり直す
                  </Button>
                </div>
              )}
            </Card>

            {/* Summary section - only visible when complete */}
            {isComplete && (
              <Card className="w-full mt-6 p-4 bg-white shadow-md rounded-xl">
                <h2 className="text-xl font-bold mb-4" style={{ color: "#68584B" }}>
                  回答の概要
                </h2>
                <div className="space-y-3">
                  {Object.entries(userResponses).map(([questionId, response]) => {
                    const question = questionnaireFlow.find((q) => q.id === Number.parseInt(questionId))
                    if (!question) return null

                    return (
                      <div key={questionId} className="border-b border-gray-100 pb-2">
                        <p className="text-sm font-medium text-gray-500">{question.content}</p>
                        <p style={{ color: "#68584B" }}>
                          {response instanceof File ? `ファイル: ${response.name}` : response}
                        </p>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 p-3 rounded-md" style={{ backgroundColor: "#E2F5EE", color: "#68584B" }}>
                  フィードバックをありがとうございました！実際のアプリケーションでは、このデータはサーバーに送信されます。
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Asset 6 background section with ご利用の流れ title and information card */}
      <div className="w-full relative overflow-hidden">
        <div className="relative">
          <img src="/images/asset-6.svg" alt="装飾的な背景" className="w-full h-auto" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-center w-full max-w-2xl px-4">
              <div className="flex items-center justify-center mb-4 md:mb-6">
                <img src="/images/asset-9.svg" alt="" className="h-6 md:h-8 w-auto mr-2 md:mr-3" />
                <h2 className="text-xl md:text-2xl font-bold" style={{ color: "#68584B" }}>
                  ご利用の流れ
                </h2>
                <img src="/images/asset-9.svg" alt="" className="h-6 md:h-8 w-auto ml-2 md:ml-3" />
              </div>
              <div className="mx-auto" style={{ width: "90%", maxWidth: "700px" }}>
                <img
                  src="/images/asset-12.png"
                  alt="ご利用の流れ"
                  className="w-full h-auto rounded-lg shadow-md"
                  style={{ maxHeight: "calc(100% - 40px)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer section - smaller size */}
      <footer style={{ backgroundColor: "#828282" }} className="w-full py-3 mt-auto">
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
