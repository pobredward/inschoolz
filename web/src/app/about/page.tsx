import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회사소개",
  description: "인스쿨즈 회사소개 페이지입니다.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center">회사소개</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">인스쿨즈란?</h2>
          <p className="text-gray-700 leading-relaxed">
            인스쿨즈는 대한민국 초·중·고 학생 및 졸업생을 위한 3계층 커뮤니티(학교·지역·전국)를 제공하는 웹·앱 서비스입니다. 
            동급생 간 안전한 소통, 지역 정보 교류, 전국 단위 이슈 공유를 지원하며 경험치·랭킹 시스템으로 활발한 참여를 유도합니다.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">우리의 비전</h2>
          <p className="text-gray-700 leading-relaxed">
            학생들이 안전하고 건전한 환경에서 소통할 수 있는 플랫폼을 만들어, 교육 공동체의 발전에 기여하는 것이 우리의 목표입니다.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">주요 서비스</h2>
          <ul className="space-y-2 text-gray-700">
            <li>• 학교별 커뮤니티 - 같은 학교 학생들과의 소통</li>
            <li>• 지역 커뮤니티 - 지역 정보 교류 및 소통</li>
            <li>• 전국 커뮤니티 - 전국 단위 이슈 공유</li>
            <li>• 경험치 및 랭킹 시스템 - 활발한 참여 유도</li>
            <li>• 미니게임 - 재미있는 게임으로 스트레스 해소</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">연락처</h2>
          <div className="text-gray-700">
            <p>이메일: inschoolz.official@gmail.com</p>
          </div>
        </section>
      </div>
    </div>
  );
} 