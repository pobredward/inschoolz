'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function EULAPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8">
            InSchoolz 최종 사용자 라이선스 계약 (EULA)
          </h1>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-red-600">⚠️ 부적절한 콘텐츠에 대한 무관용 정책</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-800 mb-2">금지된 콘텐츠</h3>
                <p className="text-red-700 mb-3">
                  InSchoolz는 다음과 같은 부적절한 콘텐츠에 대해 <strong>무관용 정책</strong>을 적용합니다:
                </p>
                <ul className="text-red-700 space-y-1 list-disc list-inside">
                  <li>욕설, 비속어, 혐오 표현</li>
                  <li>차별적, 인종차별적, 성차별적 콘텐츠</li>
                  <li>폭력적이거나 위협적인 내용</li>
                  <li>성적으로 부적절한 콘텐츠</li>
                  <li>스팸, 광고, 홍보성 게시물</li>
                  <li>개인정보 노출 또는 사생활 침해</li>
                  <li>허위정보 또는 악의적인 정보</li>
                  <li>저작권 침해 콘텐츠</li>
                </ul>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <h3 className="font-semibold text-orange-800 mb-2">제재 조치</h3>
                <ul className="text-orange-700 space-y-1 list-disc list-inside">
                  <li><strong>1차 위반:</strong> 경고 및 콘텐츠 삭제</li>
                  <li><strong>2차 위반:</strong> 7일 계정 정지</li>
                  <li><strong>3차 위반:</strong> 30일 계정 정지</li>
                  <li><strong>심각한 위반:</strong> 영구 계정 정지</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>1. 서비스 이용 약관</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">1.1 서비스 소개</h3>
              <p className="text-gray-700">
                InSchoolz는 학교 커뮤니티 플랫폼으로, 학생들이 안전하고 건전한 환경에서 소통할 수 있는 공간을 제공합니다.
              </p>
              
              <h3 className="font-semibold">1.2 이용 자격</h3>
              <p className="text-gray-700">
                본 서비스는 학생 및 교육 관계자를 대상으로 하며, 만 13세 이상의 사용자만 이용할 수 있습니다.
              </p>
              
              <h3 className="font-semibold">1.3 계정 책임</h3>
              <p className="text-gray-700">
                사용자는 자신의 계정과 활동에 대한 모든 책임을 지며, 타인에게 계정 정보를 제공해서는 안 됩니다.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>2. 콘텐츠 모더레이션 정책</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">2.1 콘텐츠 검열</h3>
              <p className="text-gray-700">
                모든 사용자 생성 콘텐츠는 자동화된 시스템과 인간 모더레이터에 의해 검토됩니다.
              </p>
              
              <h3 className="font-semibold">2.2 신고 시스템</h3>
              <p className="text-gray-700">
                사용자는 부적절한 콘텐츠를 신고할 수 있으며, 모든 신고는 24시간 이내에 검토됩니다.
              </p>
              
              <h3 className="font-semibold">2.3 차단 기능</h3>
              <p className="text-gray-700">
                사용자는 다른 사용자를 차단하여 해당 사용자의 콘텐츠를 보지 않을 수 있습니다.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>3. 개인정보 보호</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">3.1 수집 정보</h3>
              <p className="text-gray-700">
                필수 정보: 이메일, 사용자명, 실명<br/>
                선택 정보: 성별, 생년월일, 전화번호
              </p>
              
              <h3 className="font-semibold">3.2 정보 이용</h3>
              <p className="text-gray-700">
                수집된 정보는 서비스 제공, 사용자 인증, 커뮤니케이션 목적으로만 사용됩니다.
              </p>
              
              <h3 className="font-semibold">3.3 계정 삭제 권리</h3>
              <p className="text-gray-700">
                사용자는 언제든지 계정 삭제를 요청할 수 있으며, 개인정보는 즉시 삭제됩니다.
                단, 작성한 콘텐츠는 커뮤니티 보존을 위해 익명화되어 유지될 수 있습니다.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>4. 서비스 이용 제한</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="font-semibold">4.1 금지 행위</h3>
              <ul className="text-gray-700 space-y-1 list-disc list-inside">
                <li>타인의 권리 침해</li>
                <li>서비스 시스템 방해 또는 해킹 시도</li>
                <li>상업적 목적의 무단 이용</li>
                <li>허위 정보 유포</li>
                <li>Multiple 계정 생성</li>
              </ul>
              
              <h3 className="font-semibold">4.2 서비스 중단</h3>
              <p className="text-gray-700">
                기술적 문제, 정기 점검, 또는 법적 요구에 따라 서비스가 일시 중단될 수 있습니다.
              </p>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>5. 지적 재산권</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                InSchoolz 서비스의 모든 콘텐츠, 기능, 디자인은 저작권법에 의해 보호됩니다.
                사용자는 본인이 생성한 콘텐츠에 대한 저작권을 보유하되, 서비스 제공을 위한 
                제한적 라이선스를 회사에 부여합니다.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>6. 연락처 및 문의</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">
                본 약관에 대한 문의나 신고는 다음 연락처로 해주시기 바랍니다:<br/>
                이메일: support@inschoolz.com<br/>
                문의 시간: 평일 09:00 - 18:00<br/>
                긴급 신고: 24시간 접수 가능
              </p>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  최종 업데이트: {new Date().toLocaleDateString('ko-KR')}<br/>
                  본 약관은 앱스토어 가이드라인 1.2 (사용자 생성 콘텐츠)를 준수하여 작성되었습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 