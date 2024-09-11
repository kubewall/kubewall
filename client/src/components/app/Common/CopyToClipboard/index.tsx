import { CheckCircledIcon, CopyIcon } from "@radix-ui/react-icons";
import { memo, useState } from "react";

type CopyToClipboardProps = {
  val: string | number | boolean
}

const CopyToClipboard = memo(function ({val}: CopyToClipboardProps){
  const [hasCopied, setHasCopied] = useState(false);

  const onClick = () => {
    navigator.clipboard.writeText(val.toString());
    setHasCopied(true);
    setTimeout(() => {
      setHasCopied(false);
    }, 2000);
  };
  return (
    <>
      {
        hasCopied ? 
        <CheckCircledIcon
          className="mr-2 h-3 w-3 text-green-800 invisible group-hover/edit:visible cursor-pointer"
        />
        :
        <CopyIcon
          className="mr-2 h-3 w-3 cursor-pointer text-muted-foreground "
          onClick={onClick}
        />
      }
    </>
  );
});

export {
  CopyToClipboard
};