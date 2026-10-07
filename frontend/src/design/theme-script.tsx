export const THEME_STORAGE_KEY = "fc.theme";
export const SENIOR_STORAGE_KEY = "fc.senior";

// Runs before first paint: static export has no server to set data-theme, so without this dark users see a light flash.
const code = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;if(localStorage.getItem("${SENIOR_STORAGE_KEY}")==="1")document.documentElement.dataset.senior="true"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
