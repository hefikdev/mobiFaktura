import packageJson from "../../package.json";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const version = packageJson.version;
  
  return (
    <div className="container mx-auto py-4">
      <p className="text-xs text-muted-foreground leading-relaxed text-right">
        &copy; mobiFaktura v{version} {currentYear} for IM Technologies, internal company use only.
      </p>
    </div>
  );
}
