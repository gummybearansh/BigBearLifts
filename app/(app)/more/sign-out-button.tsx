import { signOutAction } from "@/app/(app)/more/sign-out";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="secondary" className="w-full">
        Sign out
      </Button>
    </form>
  );
}
