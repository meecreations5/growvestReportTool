import PageHeader from "@/components/ui/PageHeader";
import UserForm from "@/components/users/UserForm";

export default function CreateUserPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader eyebrow="Access control" title="Authorise staff user" description="Create a pending Microsoft access record. The Firebase UID will link automatically on first sign-in." />
      <UserForm />
    </div>
  );
}
