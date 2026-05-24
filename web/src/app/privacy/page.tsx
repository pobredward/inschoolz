import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '개인정보 처리방침 - 인스쿨즈',
  description: '인스쿨즈 개인정보 처리방침을 확인하세요.',
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="prose prose-gray max-w-none">
        <h1 className="text-3xl font-bold mb-8 text-center">개인정보 처리방침</h1>
        
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
            <p className="text-lg leading-7 mb-6">
              온마인드랩(사업자등록번호: 166-22-02407)에서 운영하는 인스쿨즈('https://inschoolz.com' 이하 '인스쿨즈')는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-2">🏢 사업자 정보</h3>
              <ul className="space-y-1 text-sm">
                <li><strong>상호:</strong> 온마인드랩</li>
                {/* <li><strong>대표자:</strong> 신선웅</li> */}
                <li><strong>사업자등록번호:</strong> 166-22-02407</li>
                {/* <li><strong>주소:</strong> 경기도 성남시 분당구 야탑로139번길 5-1</li> */}
                <li><strong>업종:</strong> 도매 및 소매업 - 전자상거래 소매업</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제1조 (개인정보의 처리 목적)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">인스쿨즈는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">1. 회원가입 및 관리</h3>
                  <p>회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 만14세 미만 아동의 개인정보 처리 시 법정대리인의 동의여부 확인, 각종 고지·통지, 고충처리 목적으로 개인정보를 처리합니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">2. 학교 커뮤니티 서비스 제공</h3>
                  <p>게시판 운영, 콘텐츠 제공, 맞춤형 서비스 제공, 본인인증, 연령인증, 서비스 이용 기록과 접속 빈도 분석, 서비스 이용의 유효성 확인, 서비스 개선에 활용하기 위하여 개인정보를 처리합니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">3. 학교 인증 서비스</h3>
                  <p>학교 재학생 및 졸업생 인증, 학교별 커뮤니티 접근 권한 관리, 지역별 서비스 제공을 위하여 개인정보를 처리합니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">4. 마케팅 및 광고에의 활용</h3>
                  <p>신규 서비스(제품) 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 및 참여기회 제공, 인구통계학적 특성에 따른 서비스 제공 및 광고 게재, 서비스의 유효성 확인, 접속빈도 파악 또는 회원의 서비스 이용에 대한 통계 등을 목적으로 개인정보를 처리합니다.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제2조 (개인정보의 처리 및 보유기간)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 인스쿨즈는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">1. 회원가입 및 관리: 서비스 이용계약 또는 회원가입 해지시까지</h3>
                  <p>다만, 다음의 사유에 해당하는 경우에는 해당 사유 종료시까지</p>
                  <ul className="list-disc ml-6 mt-2 space-y-1">
                    <li>관계 법령 위반에 따른 수사·조사 등이 진행중인 경우에는 해당 수사·조사 종료시까지</li>
                    <li>홈페이지 이용에 따른 채권·채무관계 잔존시에는 해당 채권·채무관계 정산시까지</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">2. 학교 커뮤니티 서비스 제공: 서비스 이용계약 또는 회원가입 해지시까지</h3>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">3. 법령에 따른 보관</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
                    <li>대금결제 및 재화등의 공급에 관한 기록: 5년 (전자상거래법)</li>
                    <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
                    <li>로그인 기록: 3개월 (통신비밀보호법)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제3조 (개인정보의 제3자 제공)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 인스쿨즈는 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
              <p className="mb-4">② 인스쿨즈는 현재 개인정보를 제3자에게 제공하고 있지 않습니다.</p>
              <p>③ 향후 개인정보를 제3자에게 제공하게 되는 경우, 제공받는 자, 제공목적, 제공하는 개인정보 항목, 제공받는 자의 보유·이용기간을 사전에 고지하고 동의를 받겠습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제4조 (개인정보처리 위탁)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 인스쿨즈는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">위탁받는 자</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">위탁하는 업무의 내용</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">위탁기간</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Google (Firebase)</td>
                      <td className="border border-gray-300 px-4 py-2">회원가입, 인증, 데이터베이스 관리, 클라우드 스토리지</td>
                      <td className="border border-gray-300 px-4 py-2">회원탈퇴시 또는 위탁계약 종료시까지</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">Vercel</td>
                      <td className="border border-gray-300 px-4 py-2">웹사이트 호스팅 및 배포</td>
                      <td className="border border-gray-300 px-4 py-2">서비스 이용계약 종료시까지</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <p className="mt-4">② 인스쿨즈는 위탁계약 체결시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 기술적·관리적 보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 계약서 등 문서에 명시하고, 수탁자가 개인정보를 안전하게 처리하는지를 감독하고 있습니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제5조 (정보주체의 권리·의무 및 행사방법)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 정보주체는 인스쿨즈에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
              
              <ol className="list-decimal ml-6 space-y-2 mb-4">
                <li>개인정보 처리현황 통지요구</li>
                <li>개인정보 열람요구</li>
                <li>개인정보 정정·삭제요구</li>
                <li>개인정보 처리정지요구</li>
              </ol>
              
              <p className="mb-4">② 제1항에 따른 권리 행사는 인스쿨즈에 대해 「개인정보 보호법」 시행령 제41조제1항에 따라 서면, 전자우편, 모사전송(FAX) 등을 통하여 하실 수 있으며 인스쿨즈는 이에 대해 지체 없이 조치하겠습니다.</p>
              
              <p className="mb-4">③ 정보주체가 개인정보의 오류 등에 대한 정정 또는 삭제를 요구한 경우에는 인스쿨즈는 정정 또는 삭제를 완료할 때까지 당해 개인정보를 이용하거나 제공하지 않습니다.</p>
              
              <p>④ 제1항에 따른 권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 하실 수 있습니다. 이 경우 "개인정보 처리 방법에 관한 고시(제2020-7호)" 별지 제11호 서식에 따른 위임장을 제출하셔야 합니다.</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제6조 (처리하는 개인정보 항목)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">인스쿨즈는 다음의 개인정보 항목을 처리하고 있습니다.</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">1. 회원가입 및 관리</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>필수항목:</strong> 이메일, 비밀번호, 사용자명(아이디), 실명</li>
                <li><strong>선택항목:</strong> 성별, 생년월일, 휴대폰번호</li>
                    <li><strong>선택항목:</strong> 프로필이미지, 추천인정보</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">2. 학교 인증 서비스</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>필수항목:</strong> 학교명, 학년, 반, 번호, 졸업여부</li>
                    <li><strong>선택항목:</strong> 즐겨찾는 학교 목록</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">3. 지역 서비스</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>필수항목:</strong> 시/도, 시/군/구</li>
                    <li><strong>선택항목:</strong> 상세주소</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">4. 서비스 이용 과정에서 자동 수집되는 정보</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li>IP주소, 쿠키, MAC주소, 서비스 이용 기록, 방문 기록, 불량 이용 기록 등</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제7조 (개인정보의 파기)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 인스쿨즈는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 해당 개인정보를 파기합니다.</p>
              
              <p className="mb-4">② 정보주체로부터 동의받은 개인정보 보유기간이 경과하거나 처리목적이 달성되었음에도 불구하고 다른 법령에 따라 개인정보를 계속 보존하여야 하는 경우에는, 해당 개인정보를 별도의 데이터베이스(DB)로 옮기거나 보관장소를 달리하여 보존합니다.</p>
              
              <div className="space-y-4 mt-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">1. 개인정보 파기절차</h3>
                  <p>인스쿨즈는 파기 사유가 발생한 개인정보를 선정하고, 인스쿨즈의 개인정보 보호책임자의 승인을 받아 개인정보를 파기합니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">2. 개인정보 파기방법</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>전자적 파일 형태:</strong> 기록을 재생할 수 없도록 로우레벨포맷(Low Level Format) 등의 방법을 이용하여 파기</li>
                    <li><strong>종이 문서:</strong> 분쇄기로 분쇄하거나 소각하여 파기</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제8조 (개인정보의 안전성 확보조치)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">인스쿨즈는 개인정보보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적/관리적 및 물리적 조치를 하고 있습니다.</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-lg mb-2">1. 정기적인 자체 감사</h3>
                  <p>개인정보 취급 관련 안정성 확보를 위해 정기적(분기 1회)으로 자체 감사를 실시하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">2. 개인정보 취급 직원의 최소화 및 교육</h3>
                  <p>개인정보를 취급하는 직원을 지정하고 담당자에 한정시켜 최소화하여 개인정보를 관리하는 대책을 시행하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">3. 내부관리계획의 수립 및 시행</h3>
                  <p>개인정보의 안전한 처리를 위하여 내부관리계획을 수립하고 시행하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">4. 해킹 등에 대비한 기술적 대책</h3>
                  <p>인스쿨즈는 해킹이나 컴퓨터 바이러스 등에 의한 개인정보 유출 및 훼손을 막기 위하여 보안프로그램을 설치하고 주기적인 갱신·점검을 하며 외부로부터 접근이 통제된 구역에 시스템을 설치하고 기술적/물리적으로 감시 및 차단하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">5. 개인정보의 암호화</h3>
                  <p>이용자의 개인정보는 비밀번호는 암호화 되어 저장 및 관리되고 있어, 본인만이 알 수 있으며 중요한 데이터는 파일 및 전송 데이터를 암호화 하거나 파일 잠금 기능을 사용하는 등의 별도 보안기능을 사용하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">6. 접속기록의 보관 및 위변조 방지</h3>
                  <p>개인정보처리시스템에 접속한 기록을 최소 1년 이상 보관, 관리하고 있으며, 접속 기록이 위변조 및 도난, 분실되지 않도록 보안기능을 사용하고 있습니다.</p>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg mb-2">7. 개인정보에 대한 접근 제한</h3>
                  <p>개인정보를 처리하는 데이터베이스시스템에 대한 접근권한의 부여,변경,말소를 통하여 개인정보에 대한 접근통제를 위하여 필요한 조치를 하고 있으며 침입차단시스템을 이용하여 외부로부터의 무단 접근을 통제하고 있습니다.</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제9조 (개인정보 보호책임자)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">① 인스쿨즈는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
              
                             <div className="bg-white p-4 rounded border">
                 <h3 className="font-bold text-lg mb-2">▶ 개인정보 보호책임자</h3>
                 <ul className="space-y-1">
                   {/* <li><strong>성명:</strong> 신선웅</li> */}
                   {/* <li><strong>직책:</strong> 대표</li> */}
                   <li><strong>상호:</strong> 온마인드랩</li>
                   <li><strong>사업자등록번호:</strong> 166-22-02407</li>
                   {/* <li><strong>주소:</strong> 경기도 성남시 분당구 야탑로139번길 5-1</li> */}
                   <li><strong>연락처:</strong> inschoolz.official@gmail.com</li>
                 </ul>
                 <p className="text-sm text-gray-600 mt-2">
                   ※ 개인정보 보호 담당부서로 연결됩니다.
                 </p>
               </div>
              
              <p className="mt-4">② 정보주체께서는 인스쿨즈의 서비스(또는 사업)을 이용하시면서 발생한 모든 개인정보 보호 관련 문의, 불만처리, 피해구제 등에 관한 사항을 개인정보 보호책임자 및 담당부서로 문의하실 수 있습니다. 인스쿨즈는 정보주체의 문의에 대해 지체 없이 답변 및 처리해드릴 것입니다.</p>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                <h4 className="font-bold text-base mb-2 text-blue-800">🚨 신고 및 고충처리 안내</h4>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li>• 부적절한 콘텐츠나 사용자에 대한 모든 신고는 <strong>24시간 이내</strong>에 검토됩니다.</li>
                  <li>• 개인정보 침해 관련 고충은 접수 즉시 우선 처리하며, 처리 결과는 알림으로 안내됩니다.</li>
                  <li>• 긴급한 사안의 경우 더욱 신속히 대응하여 사용자 안전을 보장합니다.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
                         <h2 className="text-2xl font-bold mb-4">제10조 (개인정보 처리방침 변경)</h2>
             <div className="bg-gray-50 p-6 rounded-lg">
               <p className="mb-4">① 이 개인정보처리방침은 2025년 7월 21일부터 적용됩니다.</p>
               <p>② 이전의 개인정보 처리방침은 아래에서 확인하실 수 있습니다.</p>
             </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">제11조 (권익침해 구제방법)</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="mb-4">정보주체는 아래의 기관에 대해 개인정보 침해신고, 상담등을 문의하실 수 있습니다.</p>
              <p className="mb-4 text-sm text-gray-600">
                &lt;아래의 기관은 인스쿨즈와는 별개의 기관으로서, 인스쿨즈의 자체적인 개인정보 불만처리, 피해구제 결과에 만족하지 못하시거나 보다 자세한 도움이 필요하시면 문의하여 주시기 바랍니다&gt;
              </p>
              
              <div className="space-y-4">
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-bold mb-2">▶ 개인정보 침해신고센터 (개인정보보호위원회 운영)</h3>
                  <ul className="space-y-1 text-sm">
                    <li>소관업무: 개인정보 침해신고, 상담, 집단분쟁조정</li>
                    <li>홈페이지: privacy.go.kr</li>
                    <li>전화: (국번없이) 182</li>
                    <li>주소: (03171) 서울특별시 종로구 세종대로 209 정부서울청사 4층</li>
                  </ul>
                </div>
                
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-bold mb-2">▶ 개인정보 분쟁조정위원회</h3>
                  <ul className="space-y-1 text-sm">
                    <li>소관업무: 개인정보 분쟁조정신청, 집단분쟁조정 (민사적 해결)</li>
                    <li>홈페이지: www.kopico.go.kr</li>
                    <li>전화: (국번없이) 1833-6972</li>
                    <li>주소: (03171) 서울특별시 종로구 세종대로 209 정부서울청사 4층</li>
                  </ul>
                </div>
                
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-bold mb-2">▶ 대검찰청 사이버범죄수사단</h3>
                  <ul className="space-y-1 text-sm">
                    <li>홈페이지: www.spo.go.kr</li>
                    <li>전화: 02-3480-3573</li>
                  </ul>
                </div>
                
                <div className="bg-white p-4 rounded border">
                  <h3 className="font-bold mb-2">▶ 경찰청 사이버테러대응센터</h3>
                  <ul className="space-y-1 text-sm">
                    <li>홈페이지: www.netan.go.kr</li>
                    <li>전화: (국번없이) 182</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
} 