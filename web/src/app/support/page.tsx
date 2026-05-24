'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  MessageSquare, 
  Clock,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ContactForm {
  category: string;
  subject: string;
  message: string;
  email: string;
  priority: string;
}

const initialForm: ContactForm = {
  category: '',
  subject: '',
  message: '',
  email: '',
  priority: 'normal'
};

const categories = [
  { value: 'account', label: '계정 관련' },
  { value: 'technical', label: '기술적 문제' },
  { value: 'community', label: '커뮤니티 관련' },
  { value: 'report', label: '신고/제재' },
  { value: 'suggestion', label: '제안/피드백' },
  { value: 'other', label: '기타' }
];

const priorities = [
  { value: 'low', label: '낮음', color: 'bg-gray-100 text-gray-800' },
  { value: 'normal', label: '보통', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: '높음', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: '긴급', color: 'bg-red-100 text-red-800' }
];

export default function SupportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.category || !form.subject || !form.message) {
      toast.error('모든 필수 항목을 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // TODO: 실제 API로 문의 제출
      // await submitSupportRequest({
      //   ...form,
      //   userId: user?.uid,
      //   userEmail: user?.email || form.email
      // });
      
      // 임시로 성공 처리
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIsSubmitted(true);
      toast.success('문의가 성공적으로 제출되었습니다.');
      
      // 폼 초기화
      setForm(initialForm);
    } catch (error) {
      console.error('문의 제출 오류:', error);
      toast.error('문의 제출에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateForm = (field: keyof ContactForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Card>
            <CardContent className="p-8">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-4">문의가 접수되었습니다</h2>
              <p className="text-gray-600 mb-6">
                빠른 시일 내에 답변드리겠습니다. 문의 내용은 등록하신 이메일로도 발송됩니다.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => setIsSubmitted(false)}
                  variant="outline"
                  className="mr-2"
                >
                  추가 문의하기
                </Button>
                <Button onClick={() => window.history.back()}>
                  이전 페이지로
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <MessageSquare className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold">고객센터</h1>
          </div>
          <p className="text-gray-600">문의사항이나 도움이 필요하시면 언제든 연락해 주세요.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 문의 양식 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  문의하기
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* 이메일 (로그인 안된 경우만) */}
                  {!user && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        이메일 <span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="email"
                        placeholder="답변을 받을 이메일 주소"
                        value={form.email}
                        onChange={(e) => updateForm('email', e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {/* 문의 유형 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      문의 유형 <span className="text-red-500">*</span>
                    </label>
                    <Select value={form.category} onValueChange={(value) => updateForm('category', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="문의 유형을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 우선순위 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">우선순위</label>
                    <Select value={form.priority} onValueChange={(value) => updateForm('priority', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority.value} value={priority.value}>
                            <div className="flex items-center gap-2">
                              <Badge className={priority.color}>{priority.label}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 제목 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      제목 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="문의 제목을 입력하세요"
                      value={form.subject}
                      onChange={(e) => updateForm('subject', e.target.value)}
                      required
                    />
                  </div>

                  {/* 내용 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      문의 내용 <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                      placeholder="문의하실 내용을 자세히 작성해 주세요. 문제 상황, 사용 환경, 스크린샷 등을 포함하면 더 빠른 해결이 가능합니다."
                      value={form.message}
                      onChange={(e) => updateForm('message', e.target.value)}
                      rows={6}
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? '제출 중...' : '문의 제출'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* 사이드바 */}
          <div className="space-y-6">
            {/* 연락처 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">연락처 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">이메일</p>
                    <p className="text-sm text-gray-600">inschoolz.official@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">운영시간</p>
                    <p className="text-sm text-gray-600">평일 09:00 - 18:00</p>
                    <p className="text-sm text-gray-600">(주말, 공휴일 제외)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">평균 응답 시간</p>
                    <p className="text-sm text-gray-600">24시간 이내</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 빠른 도움말 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  빠른 도움말
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">계정 문제</p>
                  <p className="text-xs text-blue-600">로그인, 비밀번호, 회원정보 관련</p>
                </div>
                
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800">커뮤니티 이용</p>
                  <p className="text-xs text-green-600">게시글, 댓글, 신고 관련</p>
                </div>
                
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm font-medium text-orange-800">기술적 문제</p>
                  <p className="text-xs text-orange-600">버그, 오류, 접속 장애 관련</p>
                </div>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => window.open('/help', '_blank')}
                >
                  전체 도움말 보기
                </Button>
              </CardContent>
            </Card>

            {/* 주의사항 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  문의 시 주의사항
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• 개인정보(비밀번호, 주민번호 등)는 포함하지 마세요</li>
                  <li>• 문제 상황을 구체적으로 설명해 주세요</li>
                  <li>• 스크린샷이나 오류 메시지를 첨부하면 도움이 됩니다</li>
                  <li>• 욕설이나 비방은 답변이 제한될 수 있습니다</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 