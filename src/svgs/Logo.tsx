import Image from "next/image";

const Logo = (props: { className: string }) => {
  return (
    <div className="flex select-none items-center gap-2">
      <Image
        className="select-none object-cover"
        src="/static/logo.svg"
        alt="Codexa logo"
        draggable={false}
        width={25}
        height={25}
      />
      <h1
        className={
          "font-logo text-2xl font-medium text-slate-900 dark:text-slate-100"
        }
      >
        Codexa
      </h1>
    </div>
  );
};

export default Logo;
