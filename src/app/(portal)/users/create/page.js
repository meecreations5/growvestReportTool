import PageHeader from "@/components/ui/PageHeader";
import UserForm from "@/components/users/UserForm";

export default function CreateUserPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader
        eyebrow="Identity and access management"
        title="Authorise Staff User"
        description="Pre-authorise an exact Microsoft organisational account, assign its system role and define the Advisor communication identity where applicable."
        breadcrumb="Users, Roles & Permissions / New Staff User"
      />
      <UserForm />
    </div>
  );
}
