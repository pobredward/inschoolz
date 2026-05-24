import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "청소년보호정책",
  description: "인스쿨즈 청소년보호정책 페이지입니다.",
};

export default function YouthProtectionPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">청소년보호정책</h1>
      
      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제1조 (목적)</h2>
          <p className="leading-relaxed">
            이 정책은 정보통신망 이용촉진 및 정보보호 등에 관한 법률 및 청소년보호법에 따라 청소년이 안전하게 인터넷을 이용할 수 있도록 하고, 청소년을 유해한 온라인 환경으로부터 보호하는 것을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제2조 (청소년보호책임자)</h2>
          <div className="space-y-4">
            <p>인스쿨즈는 청소년보호를 위하여 다음과 같이 청소년보호책임자를 지정하여 운영하고 있습니다:</p>
            <div className="ml-4 space-y-2 bg-gray-50 p-4 rounded">
              <p><strong>청소년보호책임자</strong></p>
              <p>• 이름: 인스쿨즈 팀</p>
              <p>• 연락처: inschoolz.official@gmail.com</p>
              {/* <p>• 전화번호: 010-7656-7933</p> */}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제3조 (유해정보에 대한 청소년접근제한 및 관리조치)</h2>
          <div className="space-y-4">
            <p>1. 인스쿨즈는 청소년에게 유해한 정보가 노출되지 않도록 다음과 같은 조치를 취하고 있습니다:</p>
            <ul className="ml-4 space-y-2">
              <li>• 청소년 유해매체물에 대한 라벨링 및 필터링</li>
              <li>• 청소년 유해정보에 대한 인식표시 및 접근제한</li>
              <li>• 청소년보호를 위한 이용자 신고시스템 운영</li>
              <li>• 모니터링을 통한 청소년 유해정보 게시 방지</li>
            </ul>
            <p>2. 유해정보의 종류:</p>
            <ul className="ml-4 space-y-2">
              <li>• 선정적이고 음란한 내용</li>
              <li>• 폭력적이고 잔혹한 내용</li>
              <li>• 도박 등 사행행위를 조장하는 내용</li>
              <li>• 청소년의 건전한 인격형성을 저해하는 내용</li>
              <li>• 기타 청소년에게 유해하다고 인정되는 내용</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제4조 (청소년보호를 위한 시스템 구축)</h2>
          <div className="space-y-2">
            <p>1. 인스쿨즈는 청소년보호를 위해 다음과 같은 시스템을 구축·운영하고 있습니다:</p>
            <ul className="ml-4 space-y-1">
              <li>• 유해정보 필터링 시스템</li>
              <li>• 신고접수 및 처리시스템</li>
              <li>• 모니터링 시스템</li>
              <li>• 이용시간 제한 시스템</li>
            </ul>
            <p>2. 청소년이 건전하게 이용할 수 있도록 커뮤니티 이용규칙을 제정하여 운영하고 있습니다.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제5조 (유해정보 신고 및 처리)</h2>
          <div className="space-y-4">
            <p>1. 이용자는 본 사이트 내에서 청소년에게 유해한 정보를 발견할 경우 다음의 방법으로 신고할 수 있습니다:</p>
            <ul className="ml-4 space-y-1">
              <li>• 이메일: inschoolz.official@gmail.com</li>
              {/* <li>• 전화: 010-7656-7933</li> */}
              <li>• 사이트 내 신고 기능 이용</li>
            </ul>
            <p>2. 신고된 정보에 대해서는 24시간 이내에 확인하고 필요한 조치를 취합니다.</p>
            <p>3. 처리 결과는 신고자에게 통보됩니다.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제6조 (청소년 이용자 보호 조치)</h2>
          <div className="space-y-2">
            <p>1. 인스쿨즈는 청소년 이용자를 보호하기 위해 다음과 같은 조치를 시행합니다:</p>
            <ul className="ml-4 space-y-1">
              <li>• 개인정보 보호를 위한 별도의 관리</li>
              <li>• 사이버 괴롭힘 및 따돌림 방지</li>
              <li>• 건전한 커뮤니티 문화 조성</li>
              <li>• 청소년 상담 및 지원 서비스 제공</li>
            </ul>
            <p>2. 청소년 이용자의 안전을 위해 익명 게시판에서도 적절한 모니터링을 실시합니다.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제7조 (교육 및 홍보)</h2>
          <div className="space-y-2">
            <p>1. 인스쿨즈는 청소년보호를 위해 다음과 같은 교육 및 홍보 활동을 실시합니다:</p>
            <ul className="ml-4 space-y-1">
              <li>• 올바른 인터넷 이용 방법 안내</li>
              <li>• 사이버 윤리 교육 자료 제공</li>
              <li>• 유해정보 식별 및 대응 방법 안내</li>
              <li>• 건전한 커뮤니티 참여 방법 교육</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제8조 (법정대리인의 권리)</h2>
          <div className="space-y-2">
            <p>1. 만 14세 미만 아동의 법정대리인은 아동의 개인정보 처리 정지를 요구할 수 있습니다.</p>
            <p>2. 법정대리인은 아동이 이용하는 서비스에 대한 이용내역을 확인할 수 있습니다.</p>
            <p>3. 법정대리인의 요청이 있을 경우 해당 아동의 서비스 이용을 제한할 수 있습니다.</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-black">제9조 (정책의 시행 및 변경)</h2>
          <div className="space-y-2">
            <p>1. 이 정책은 2025년 1월 1일부터 시행됩니다.</p>
            <p>2. 정책 변경 시에는 변경사항을 사이트에 공지합니다.</p>
            <p>3. 청소년보호정책에 대한 문의사항이 있으시면 청소년보호책임자에게 연락주시기 바랍니다.</p>
          </div>
        </section>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">청소년 및 학부모 여러분께</h3>
            <p className="text-blue-800">
              인스쿨즈는 청소년이 안전하고 건전하게 이용할 수 있는 온라인 공간을 만들기 위해 최선을 다하고 있습니다. 
              유해한 정보나 부적절한 행동을 발견하시면 언제든지 신고해 주시기 바랍니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 