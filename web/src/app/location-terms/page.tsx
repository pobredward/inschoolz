import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '위치기반 서비스 이용약관 - 인스쿨즈',
  description: '인스쿨즈 위치기반 서비스 이용약관을 확인하세요.',
};

export default function LocationTermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-gray max-w-none">
        <h1 className="text-3xl font-bold mb-8 text-center">위치기반 서비스 이용약관</h1>
        
        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <p className="text-sm text-gray-600 mb-2">
            <strong>시행일자:</strong> 2025년 7월 21일
          </p>
          <p className="text-sm text-gray-600">
            <strong>최종 수정일:</strong> 2024년 12월 13일
          </p>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold mb-4">제1조 (목적)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p>본 약관은 온마인드랩(사업자등록번호: 166-22-02407)이 제공하는 인스쿨즈 서비스(이하 &ldquo;서비스&rdquo;)에서 제공하는 위치기반서비스에 대해 회사와 개인위치정보주체(이하 &ldquo;이용자&rdquo;)간의 권리·의무 및 책임사항, 기타 필요한 사항 규정을 목적으로 합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제2조 (약관 외 준칙)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p>이 약관에 명시되지 않은 사항에 대해서는 위치정보의 보호 및 이용 등에 관한 법률, 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 전기통신사업법 등 관계법령과 회사의 이용약관 및 개인정보처리방침, 회사가 별도로 정한 지침 등에 의합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제3조 (서비스 내용 및 요금)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 직접 수집하거나 위치정보사업자로부터 수집한 이용자의 현재 위치 또는 현재 위치가 포함된 지역을 이용하여 아래와 같은 위치기반서비스를 제공합니다.
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li><strong>지역별 커뮤니티 서비스:</strong> 이용자의 현재 위치를 기준으로 해당 지역의 커뮤니티 정보 제공</li>
                    <li><strong>주변 학교 정보 제공:</strong> 이용자의 위치 주변에 있는 학교 정보 및 학교별 커뮤니티 추천</li>
                    <li><strong>위치 기반 맞춤 콘텐츠:</strong> 지역별 특성에 맞는 게시글, 이벤트 정보 제공</li>
                    <li><strong>지역별 랭킹 서비스:</strong> 지역 단위로 구분된 사용자 활동 랭킹 제공</li>
                  </ul>
                </li>
                <li>제1항의 위치기반서비스는 무료로 제공됩니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제4조 (개인위치정보주체의 권리)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>이용자는 언제든지 개인위치정보 수집·이용·제공에 대한 동의 전부 또는 일부를 철회할 수 있습니다.</li>
                <li>이용자는 언제든지 개인위치정보의 수집·이용·제공의 일시정지를 요구할 수 있습니다. 이 경우 회사는 요구를 거절하지 아니하며, 이를 위한 기술적 수단을 갖추고 있습니다.</li>
                <li>이용자는 회사에 대하여 아래 자료의 열람 또는 고지를 요구할 수 있고, 당해 자료에 오류가 있는 경우에는 그 정정을 요구할 수 있습니다. 이 경우 회사는 정당한 사유 없이 요구를 거절하지 아니합니다.
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>개인위치정보의 수집·이용·제공사실 확인자료</li>
                    <li>개인위치정보가 위치정보의 보호 및 이용 등에 관한 법률 또는 다른 법률 규정에 의하여 제3자에게 제공된 현황</li>
                  </ul>
                </li>
                <li>이용자는 제1항부터 제3항까지의 권리행사를 위하여 회사의 소정의 절차를 통해 요구할 수 있습니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제5조 (개인위치정보의 이용·제공)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 개인위치정보를 이용하여 서비스를 제공하고자 하는 경우에는 미리 이용약관에 명시한 후 개인위치정보주체의 동의를 얻어야 합니다.</li>
                <li>이용자가 만 14세 미만의 아동인 경우에는 법정대리인의 동의를 얻어야 합니다.</li>
                <li>회사는 이용자의 동의 없이 개인위치정보를 제3자에게 제공하지 않으며, 제3자에게 제공하는 경우에는 제공받는 자 및 제공목적을 사전에 이용자에게 고지하고 동의를 받습니다.</li>
                <li>회사는 개인위치정보를 수집한 목적 범위에서만 이용하며, 목적이 변경될 경우에는 미리 이용자의 동의를 얻습니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제6조 (개인위치정보의 보유기간 및 이용기간)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 위치정보의 보호 및 이용 등에 관한 법률 제16조 제2항에 근거하여 개인위치정보를 수집한 시점으로부터 1년을 초과하여 보관하지 않습니다.</li>
                <li>회사는 개인위치정보 수집 · 이용에 대한 동의를 받을 때 개인위치정보의 보유기간 및 이용기간을 명확히 고지하고 동의를 받습니다.</li>
                <li>회사는 이용자가 회원탈퇴를 한 경우 즉시 개인위치정보를 파기합니다. 다만, 관련 법령에 의해 보존할 의무가 있는 경우에는 그러하지 아니합니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제7조 (개인위치정보의 파기)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 개인위치정보가 불필요하게 되었을 때에는 지체 없이 해당 개인위치정보를 파기합니다.</li>
                <li>이용자가 개인위치정보의 수집·이용·제공에 대한 동의를 전부 철회한 경우에는 지체 없이 개인위치정보 및 위치정보 수집·이용·제공사실 확인자료를 파기합니다. 다만, 동의철회를 한 때에 수집·이용·제공사실 확인자료의 보관기간이 남아 있는 경우에는 그러하지 아니합니다.</li>
                <li>회사는 개인위치정보를 파기하는 경우 복구 또는 재생되지 아니하도록 조치합니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제8조 (위치정보관리책임자의 지정)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 위치정보를 적절히 관리·보호하고 개인위치정보주체의 불만을 원활히 처리할 수 있도록 위치정보관리책임자를 지정하여 운영하고 있습니다.</li>
                <li>위치정보관리책임자는 위치기반서비스를 제공하는 부서의 부서장으로서 구체적인 사항은 회사의 고객센터 또는 회사의 웹사이트를 통해 확인할 수 있습니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제9조 (손해배상 및 면책)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사가 위치정보의 보호 및 이용 등에 관한 법률 제15조내지 제26조의 규정을 위반한 행위로 이용자에게 손해가 발생한 경우 이용자는 회사에 대하여 손해배상을 청구할 수 있습니다. 이 경우 회사는 고의, 중과실이 없음을 입증하지 못하는 경우 책임을 부담합니다.</li>
                <li>회사는 이용자로부터 위치정보를 전달받지 못하거나 잘못된 위치정보를 전달받아 발생한 손해에 대해서는 책임을 부담하지 않습니다.</li>
                <li>회사는 천재지변 등 불가항력적 사유로 위치기반서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임을 부담하지 않습니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제10조 (분쟁의 조정 및 기타)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <ol className="list-decimal ml-6 space-y-3">
                <li>회사는 위치정보와 관련된 분쟁에 대해 당사자간 합의가 이루어지지 않거나 손해배상의 원만한 해결이 어려운 경우에는 방송통신위원회에 재정을 신청할 수 있습니다.</li>
                <li>회사 또는 이용자는 위치정보와 관련된 분쟁에 대해 당사자간 합의가 이루어지지 않는 경우에는 개인정보 분쟁조정위원회에 조정을 신청할 수 있습니다.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제11조 (회사의 연락처)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="bg-white p-4 rounded border">
                <h3 className="font-bold text-lg mb-2">▶ 위치정보관리책임자</h3>
                <ul className="space-y-1">
                  <li><strong>상호:</strong> 온마인드랩</li>
                  {/* <li><strong>대표자:</strong> 신선웅</li> */}
                  <li><strong>사업자등록번호:</strong> 166-22-02407</li>
                  {/* <li><strong>주소:</strong> 경기도 성남시 분당구 야탑로139번길 5-1</li> */}
                  {/* <li><strong>연락처:</strong> 010-7656-7933</li> */}
                  <li><strong>이메일:</strong> inschoolz.official@gmail.com</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">부칙</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p>이 약관은 2025년 7월 21일부터 시행됩니다.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 