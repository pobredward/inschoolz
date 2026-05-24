"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Star, MessageCircle, Shield, Gamepad2, BarChart3, Bell, Bot, Calendar, School, Zap, Target } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

export default function AdminDashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">관리자 대시보드</h1>
        <p className="text-muted-foreground mt-2">인스쿨즈 시스템 관리 및 통계를 확인하세요.</p>
      </div>

      {/* 시스템 관리 */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">시스템 관리</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/experience">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Star className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">경험치 관리</h3>
                      <p className="text-sm text-muted-foreground">경험치 설정 및 레벨 관리</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/admin/community">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <MessageCircle className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">커뮤니티 관리</h3>
                      <p className="text-sm text-muted-foreground">게시판 생성 및 설정</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/notifications">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <Bell className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">알림 설정</h3>
                      <p className="text-sm text-muted-foreground">전체 사용자 알림 발송</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/reports">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Shield className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">신고 관리</h3>
                      <p className="text-sm text-muted-foreground">신고 처리 및 제재</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/users">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">유저 관리</h3>
                      <p className="text-sm text-muted-foreground">회원 정보 및 권한 관리</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="opacity-50 cursor-not-allowed">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Gamepad2 className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">게임 관리</h3>
                    <p className="text-sm text-muted-foreground">미니게임 설정 및 점수</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Link href="/admin/schools">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">학교 관리</h3>
                      <p className="text-sm text-muted-foreground">학교 정보 및 설정 관리</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* AI 관리 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">AI 관리</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/fake-posts">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Calendar className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">게시글 관리</h3>
                      <p className="text-sm text-muted-foreground">AI 게시글 조회, 수정, 삭제</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/fake-bots">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Bot className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">봇 계정 관리</h3>
                      <p className="text-sm text-muted-foreground">봇 현황 및 통계</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/fake-comments">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <MessageCircle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">댓글 관리</h3>
                      <p className="text-sm text-muted-foreground">AI 댓글 검토 및 승인</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/fake-schools">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <School className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">학교 관리</h3>
                      <p className="text-sm text-muted-foreground">학교별 봇 생성 및 관리</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/fake-operations">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <Zap className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">대량 작업</h3>
                      <p className="text-sm text-muted-foreground">대량 생성, 삭제, 정리</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 