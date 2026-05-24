'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronRight,
  MessageSquare, 
  Heart, 
  Bookmark,
  Star,
  Users,
  Shield,
  Mail,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  isOpen?: boolean;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    category: '회원가입',
    question: '회원가입은 어떻게 하나요?',
    answer: '홈페이지 상단의 "회원가입" 버튼을 클릭하여 이메일과 학교 정보를 입력하시면 됩니다. 본인 확인을 위해 학교 인증이 필요합니다.'
  },
  {
    id: '2',
    category: '회원가입',
    question: '학교 인증은 어떻게 하나요?',
    answer: '회원가입 시 본인의 학교를 선택하고, 학교 이메일 또는 학생증을 통해 인증할 수 있습니다. 자세한 인증 방법은 회원가입 과정에서 안내됩니다.'
  },
  {
    id: '3',
    category: '커뮤니티',
    question: '게시글은 어떻게 작성하나요?',
    answer: '원하는 커뮤니티(전국/지역/학교)에 들어가서 "글쓰기" 버튼을 클릭하면 됩니다. 제목과 내용을 입력하고, 필요시 이미지를 첨부할 수 있습니다.'
  },
  {
    id: '4',
    category: '커뮤니티',
    question: '익명으로 글을 쓸 수 있나요?',
    answer: '네, 글 작성 시 "익명" 옵션을 선택하면 닉네임 대신 "익명"으로 표시됩니다. 단, 일부 게시판에서는 익명 작성이 제한될 수 있습니다.'
  },
  {
    id: '5',
    category: '기능',
          question: '좋아요와 스크랩의 차이는 무엇인가요?',
      answer: '좋아요는 게시글에 대한 공감을 표시하는 기능이고, 스크랩은 나중에 다시 보기 위해 저장하는 기능입니다. 마이페이지에서 스크랩한 글들을 확인할 수 있습니다.'
  },
  {
    id: '6',
    category: '기능',
    question: '경험치는 어떻게 얻나요?',
    answer: '게시글 작성(10XP), 댓글 작성(5XP), 좋아요 받기(1XP), 출석체크, 미니게임 등을 통해 경험치를 얻을 수 있습니다. 일일 제한이 있으니 참고하세요.'
  },
  {
    id: '7',
    category: '신고',
    question: '부적절한 게시글을 발견했어요.',
    answer: '게시글 우측 상단의 "..." 메뉴에서 "신고하기"를 선택하여 신고할 수 있습니다. 신고 사유를 선택하고 상세 내용을 작성해 주세요.'
  },
  {
    id: '8',
    category: '계정',
    question: '비밀번호를 잊어버렸어요.',
    answer: '로그인 페이지의 "비밀번호 찾기" 링크를 클릭하여 가입 시 사용한 이메일로 비밀번호 재설정 링크를 받을 수 있습니다.'
  }
];

const categories = ['전체', '회원가입', '커뮤니티', '기능', '신고', '계정'];

export default function HelpPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [openItems, setOpenItems] = useState<string[]>([]);

  const filteredFAQ = selectedCategory === '전체' 
    ? faqData 
    : faqData.filter(item => item.category === selectedCategory);

  const toggleItem = (id: string) => {
    setOpenItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold">도움말</h1>
          </div>
          <p className="text-gray-600">Inschoolz 사용법과 자주 묻는 질문들을 확인하세요.</p>
        </div>

        {/* 빠른 가이드 */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">빠른 시작 가이드</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">첫 글 작성하기</h3>
                <p className="text-sm text-gray-600">커뮤니티에서 첫 게시글을 작성해보세요</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <Heart className="h-8 w-8 text-red-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">좋아요 누르기</h3>
                <p className="text-sm text-gray-600">마음에 드는 글에 좋아요를 눌러보세요</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                            <Bookmark className="h-8 w-8 text-blue-500 mx-auto mb-3" />
            <h3 className="font-semibold mb-2">글 스크랩하기</h3>
                <p className="text-sm text-gray-600">나중에 다시 볼 글을 저장해보세요</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <Star className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">경험치 쌓기</h3>
                <p className="text-sm text-gray-600">활동하며 경험치를 쌓고 레벨업하세요</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">자주 묻는 질문</h2>
          
          {/* 카테고리 필터 */}
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="text-sm"
              >
                {category}
              </Button>
            ))}
          </div>

          {/* FAQ 리스트 */}
          <div className="space-y-3">
            {filteredFAQ.map((item) => (
              <Card key={item.id}>
                <Collapsible>
                  <CollapsibleTrigger 
                    className="w-full"
                    onClick={() => toggleItem(item.id)}
                  >
                    <CardHeader className="hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-xs">
                            {item.category}
                          </Badge>
                          <h3 className="font-medium text-left">{item.question}</h3>
                        </div>
                        {openItems.includes(item.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </div>

        {/* 문의하기 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              추가 문의
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              원하는 답변을 찾지 못하셨나요? 아래 방법으로 문의해 주세요.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">이메일 문의</p>
                  <p className="text-sm text-gray-600">inschoolz.official@gmail.com</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium">커뮤니티 문의</p>
                                     <p className="text-sm text-gray-600">전국 커뮤니티 → 문의 게시판</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">관련 링크</h4>
              <div className="flex flex-wrap gap-3">
                <Link href="/terms">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    이용약관
                  </Button>
                </Link>
                <Link href="/privacy">
                  <Button variant="outline" size="sm">
                    <Shield className="h-4 w-4 mr-2" />
                    개인정보처리방침
                  </Button>
                </Link>
                <Link href="/community-rules">
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    커뮤니티 규칙
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 