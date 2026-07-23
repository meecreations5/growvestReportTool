"use client";

import { use } from "react";
import PageHeader from "@/components/ui/PageHeader";
import UserForm from "@/components/users/UserForm";

export default function EditUserPage({ params }) {
  const { userId } = use(params);
  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <PageHeader
        eyebrow="Identity and access management"
        title="Edit Staff Access"
        description="Update staff identity, assigned system role, Advisor communication details and active access status."
        breadcrumb="Users, Roles & Permissions / Edit Staff Access"
      />
      <UserForm userId={userId} />
    </div>
  );
}
