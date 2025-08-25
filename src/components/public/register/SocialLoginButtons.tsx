'use client';

import { Button } from "@/components/ui/button";
// Step 1: Import the correct, cookie-aware client hook
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
// Optional: Import specific icons if you have them as components
// import { GoogleIcon, GithubIcon, MetaIcon } from '@/components/ui/icons';

export function SocialLoginButtons() {
  // Step 2: Create the cookie-aware Supabase client inside the component
  const supabase = createClientComponentClient();

  const handleOAuthSignIn = async (provider: "google" | "github" | "facebook") => {
    try {
      // Step 3: Call signInWithOAuth using the new, correct client
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // This tells Supabase where to redirect the user back to after they
          // have successfully authenticated with Google or GitHub.
          // This MUST be a URL listed in your Supabase project's auth settings.
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error(`Error signing in with ${provider}:`, error.message);
        // In a real app, you would show a toast notification to the user here.
      }
    } catch (error) {
      console.error("An unexpected error occurred during OAuth sign-in:", error);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      {/* Google Login Button */}
      <Button
        variant="outline"
        type="button"
        className="w-full border-border text-foreground hover:bg-accent/10 bg-card"
        onClick={() => handleOAuthSignIn("google")}
        aria-label="Sign up with Google"
      >
        {/* Placeholder for Google Icon */}
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <title>Google</title>
          <path
            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
            fill="currentColor"
          />
        </svg>
      </Button>

      {/* GitHub Login Button */}
      <Button
        variant="outline"
        type="button"
        className="w-full border-border text-foreground hover:bg-accent/10 bg-card"
        onClick={() => handleOAuthSignIn("github")}
        aria-label="Sign up with GitHub"
      >
        {/* Placeholder for GitHub Icon */}
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <title>GitHub</title>
          <path
            d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.08-.744.084-.729.084-.729 1.195.084 1.825 1.229 1.825 1.229 1.064 1.829 2.804 1.306 3.49.999.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.118-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.046.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.832 24 17.301 24 12c0-6.627-5.373-12-12-12z"
            fill="currentColor"
          />
        </svg>
      </Button>

      {/* Facebook Login Button (Example - not implemented in handler) */}
      <Button
        variant="outline"
        type="button"
        className="w-full border-border text-foreground hover:bg-accent/10 bg-card"
        onClick={() => handleOAuthSignIn("facebook")}
        aria-label="Sign up with Facebook"
        disabled // Disabled as it's not part of the handleOAuthSignIn function yet
      >
        {/* Placeholder for Facebook/Meta Icon */}
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="w-4 h-4"
        >
          <title>Meta</title>
          <path
            d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553z"
            fill="currentColor"
          />
        </svg>
      </Button>
    </div>
  );
      }