import { GetServerSideProps } from "next";

const Sitemap = () => {
  return null;
};

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const baseUrl = "https://www.inschoolz.com";

  const staticPages = ["", "community", "game", "login", "ranking"].map(
    (page) => ({
      url: `${baseUrl}/${page}`,
      lastmod: new Date().toISOString(),
    }),
  );

  const dynamicPages = [];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${[...staticPages, ...dynamicPages]
        .map(
          ({ url, lastmod }) => `
          <url>
            <loc>${url}</loc>
            <lastmod>${lastmod}</lastmod>
            <changefreq>weekly</changefreq>
            <priority>0.8</priority>
          </url>`,
        )
        .join("")}
    </urlset>`;

  res.setHeader("Content-Type", "text/xml");
  res.write(sitemap);
  res.end();

  return { props: {} };
};

export default Sitemap;
