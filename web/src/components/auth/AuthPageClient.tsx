'use client';

import { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

export default function AuthPageClient() {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <div className="flex flex-col items-center justify-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        {/* 로고 및 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            인스쿨즈
          </h1>
          <p className="mt-2 text-gray-600">대한민국 학생들의 올인원 커뮤니티</p>
        </div>

        {/* 메인 카드 */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* 탭 헤더 */}
            <div className="border-b border-gray-100">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-4 px-6 text-sm font-medium transition-colors relative ${
                    activeTab === 'login'
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  로그인
                  {activeTab === 'login' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('signup')}
                  className={`flex-1 py-4 px-6 text-sm font-medium transition-colors relative ${
                    activeTab === 'signup'
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  회원가입
                  {activeTab === 'signup' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"></div>
                  )}
                </button>
              </div>
            </div>

            {/* 탭 내용 */}
            <div className="p-6">
              {activeTab === 'login' ? (
                <LoginForm />
              ) : (
                <SignupForm />
              )}
            </div>
          </div>

          {/* 푸터 */}
          <div className="text-center mt-8 text-sm text-gray-500">
            <p>
              계정이 {activeTab === 'login' ? '없으신가요?' : '이미 있으신가요?'}{' '}
              <button
                onClick={() => setActiveTab(activeTab === 'login' ? 'signup' : 'login')}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                {activeTab === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
