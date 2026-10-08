export const THEME_STORAGE_KEY = "fc.theme";
export const SENIOR_STORAGE_KEY = "fc.senior";

// Runs before first paint: static export has no server to set data-theme, so without this dark users see a light flash.
const code = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")==="dark"?"dark":"light";document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();if(localStorage.getItem("${SENIOR_STORAGE_KEY}")==="1")document.documentElement.dataset.senior="true"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
