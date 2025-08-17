import { PublicPageLayout } from "../.layouts/PublicPageLayout";

export default function About() {
  return (
    <PublicPageLayout>
      {/* About page content goes here */}
      <div className="max-w-2xl mx-auto py-12">
        <h1 className="text-3xl font-bold mb-4">About Vectr</h1>
        <p className="text-muted mb-2">
          Vectr is a modern finance suite designed to help you manage your money with ease and confidence.
        </p>
              <p className="text-muted">
                Our mission is to empower individuals and businesses to take control of their financial future through intuitive tools and insightful analytics.
              </p>
            </div>
          </PublicPageLayout>
        );
      }