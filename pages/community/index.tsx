import { useEffect } from "react";
import { useRecoilState } from "recoil";
import { selectedCategoryState } from "../../store/atoms";
import { useRouter } from "next/router";
import Head from "next/head";
import CommunityPage from "../../components/CommunityPage";

const Community: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useRecoilState(
    selectedCategoryState,
  );
  const router = useRouter();

  useEffect(() => {
    const defaultCategory = "national-free";
    setSelectedCategory(defaultCategory);
    router.push(`/community/${defaultCategory}`);
  }, [setSelectedCategory, router]);

  return (
    <>
      <Head>
        <title>커뮤니티</title>
        <meta
          name="description"
          content="인스쿨즈 커뮤니티에서 다양한 주제로 이야기를 나누고 정보를 공유하세요."
        />
        <link rel="canonical" href="https://www.inschoolz.com/community" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "커뮤니티",
            url: "https://www.inschoolz.com/community",
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "홈",
                  item: "https://www.inschoolz.com/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "커뮤니티",
                  item: "https://www.inschoolz.com/community",
                },
              ],
            },
          })}
        </script>
      </Head>
      <CommunityPage />
    </>
  );
};

export default Community;
