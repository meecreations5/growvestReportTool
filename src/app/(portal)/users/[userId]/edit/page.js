"use client";

import { use } from "react";
import PageHeader from "@/components/ui/PageHeader";
import UserForm from "@/components/users/UserForm";

export default function EditUserPage({ params }) {
  const { userId } = use(params);
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <PageHeader eyebrow="Access control" title="Edit staff user" description="Update role, designation, advisor code and application access status." />
      <UserForm userId={userId} />
    </div>
  );
}
