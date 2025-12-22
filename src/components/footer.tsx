import packageJson from "../../package.json";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const version = packageJson.version;
  
  return (
      <p className="text-[10px] md:text-xs text-muted-foreground/20 leading-relaxed text-center md:text-right py-2">
        &copy;{currentYear} mobiFaktura v{version} for IM Technologies, internal company use only.
      </p>
  );
}
