import { GetServerSideProps } from "next";
import { db } from "../lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

const Sitemap = () => {
  return null;
};

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const baseUrl = "https://www.inschoolz.com";

  const staticPages = [
    "",
    "community",
    "game",
    "login",
    "ranking",
    "signup",
  ].map((page) => ({
    url: `${baseUrl}/${page}`,
    lastmod: new Date().toISOString(),
  }));

  // 조회수가 높은 게시글 10개 가져오기
  const postsRef = collection(db, "posts");
  const q = query(postsRef, orderBy("views", "desc"), limit(10));
  const querySnapshot = await getDocs(q);

  const dynamicPages = querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      url: `${baseUrl}/community/${data.category}/${doc.id}`,
      lastmod: data.updatedAt.toDate().toISOString(),
    };
  });

  const allPages = [...staticPages, ...dynamicPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${allPages
        .map(
          ({ url, lastmod }) => `
        <url>
          <loc>${url}</loc>
          <lastmod>${lastmod}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.7</priority>
        </url>
      `,
        )
        .join("")}
    </urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return { props: {} };
};

export default Sitemap;
