import { GetServerSideProps } from "next";
import { db } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

const Sitemap = () => {
  return null;
};

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const baseUrl = "https://inschoolz.com";

  // Firebase에서 포스트 데이터를 가져옴
  const postsSnapshot = await getDocs(
    query(
      collection(db, "posts"),
      where("categoryId", "in", [
        "national-free",
        "national-hot",
        "national-minor-develop",
        "national-minor-humor",
        "national-minor-esports",
        "national-minor-webtoon",
        "national-minor-movie",
        "national-minor-kpop",
        "national-minor-love",
        "national-minor-sports",
        "national-minor-trip",
        "national-minor-food",
        "national-minor-animal",
        "national-minor-study",
        "national-minor-career",
        "national-minor-language",
        "national-minor-coding",
      ])
    )
  );

  const getCategoryName = (categoryId) => {
    const categoryMap = {
      "national-free": "자유 게시판",
      "national-hot": "HOT 게시글",
      "national-minor-develop": "제안사항",
      "national-minor-humor": "유머/밈",
      "national-minor-esports": "모바일/PC게임",
      "national-minor-webtoon": "웹툰/만화",
      "national-minor-movie": "영화/드라마",
      "national-minor-kpop": "아이돌/KPOP",
      "national-minor-love": "연애",
      "national-minor-sports": "운동",
      "national-minor-trip": "여행",
      "national-minor-food": "맛집/요리",
      "national-minor-animal": "반려동물/동물",
      "national-minor-study": "공부/입시",
      "national-minor-career": "진로/취업",
      "national-minor-language": "영어/외국어",
      "national-minor-coding": "코딩/IT",
    };
    return categoryMap[categoryId] || "기타 게시판";
  };

  const posts = postsSnapshot.docs.map((doc) => {
    const postData = doc.data();

    const plainTextContent = postData.content.replace(/<[^>]+>/g, "");
    const sentences = plainTextContent.split(/(?<=[.!?])\s+/);
    let contentSnippet = "";

    for (let sentence of sentences) {
      if ((contentSnippet + sentence).length <= 200) {
        contentSnippet += sentence + " ";
      } else {
        break;
      }
    }

    const categoryName = getCategoryName(postData.categoryId);
    const keywords = postData.title.split(" ").slice(0, 5).join(", ");

    return {
      url: `${baseUrl}/community/${postData.categoryId}/${doc.id}`,
      lastmod: postData.createdAt.toDate().toISOString(),
      title: `${postData.title} - ${categoryName}`,
      content: contentSnippet.trim(),
      keywords,
    };
  });

  const createUrlElement = ({ url, lastmod, title, content, keywords }) => `
    <url>
      <loc>${url}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.9</priority>
      <news:news>
        <news:publication>
          <news:name>인스쿨즈</news:name>
          <news:language>ko</news:language>
        </news:publication>
        <news:publication_date>${lastmod}</news:publication_date>
        <news:title>${title}</news:title>
        <news:keywords>${keywords}</news:keywords>
        <news:description>${content}</news:description>
      </news:news>
      <xhtml:link rel="alternate" hreflang="ko" href="${url}"/>
      <xhtml:link rel="alternate" hreflang="x-default" href="${url}"/>
    </url>`;

  const staticPages = ["", "game", "ranking", "community"]
    .map((staticPagePath) =>
      createUrlElement({
        url: `${baseUrl}/${staticPagePath}`,
        lastmod: new Date().toISOString(),
        title: staticPagePath.charAt(0).toUpperCase() + staticPagePath.slice(1),
        content: "",
        keywords: "",
      })
    )
    .join("");

  const dynamicPages = posts.map(createUrlElement).join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
            xmlns:xhtml="http://www.w3.org/1999/xhtml"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
            xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
            <url>
            <loc>https://www.inschoolz.com/</loc>
            <lastmod>2024-08-29</lastmod>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
          </url>
          <url>
            <loc>https://www.inschoolz.com/community</loc>
            <lastmod>2024-08-29</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
          </url>
          <url>
            <loc>https://www.inschoolz.com/ranking</loc>
            <lastmod>2024-08-29</lastmod>
            <changefreq>daily</changefreq>
            <priority>0.8</priority>
          </url>
          <url>
            <loc>https://www.inschoolz.com/minigame</loc>
            <lastmod>2024-08-29</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.7</priority>
          </url>
          <url>
            <loc>https://www.inschoolz.com/login</loc>
            <lastmod>2024-08-29</lastmod>
            <changefreq>monthly</changefreq>
            <priority>0.6</priority>
          </url>
      ${dynamicPages}
    </urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return {
    props: {},
  };
};

export default Sitemap;
