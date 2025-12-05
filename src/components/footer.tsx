import packageJson from "../../package.json";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const version = packageJson.version;
  
  return (
      <p className="text-xs text-muted-foreground leading-relaxed text-right py-2">
        &copy; mobiFaktura v{version} {currentYear} for IM Technologies, internal company use only.
      </p>
  );
}
