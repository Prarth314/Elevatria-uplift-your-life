import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addUser, deleteUser, getAllUsers } from "@/lib/storage";
import { Lock, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

type TierSuffix = "-S" | "-P" | "-E";

const TIER_OPTIONS: {
  value: TierSuffix;
  label: string;
  description: string;
}[] = [
  { value: "-S", label: "Starter", description: "Text only" },
  { value: "-P", label: "Pro", description: "Text + Images + Chat" },
  { value: "-E", label: "Elite", description: "Full access" },
];

export default function Admin() {
  const [newUserId, setNewUserId] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");
  const [tierSuffix, setTierSuffix] = useState<TierSuffix>("-E");
  const [users, setUsers] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUsers(getAllUsers());
  }, []);

  // Compute the full code preview
  const codeBase = newAccessCode.trim();
  const alreadyHasSuffix =
    codeBase.endsWith("-S") ||
    codeBase.endsWith("-P") ||
    codeBase.endsWith("-E");
  const previewCode = codeBase
    ? alreadyHasSuffix
      ? codeBase
      : `${codeBase}${tierSuffix}`
    : "";

  const handleAddUser = () => {
    setSuccess(false);
    setError(null);

    const uid = newUserId.trim();
    const code = newAccessCode.trim();

    if (!uid || !code) {
      setError("Both User ID and Access Code are required.");
      return;
    }

    const finalCode = alreadyHasSuffix ? code : `${code}${tierSuffix}`;
    const result = addUser(uid, finalCode);

    if (result === "duplicate") {
      setError("User ID already exists.");
      return;
    }

    setUsers(getAllUsers());
    setNewUserId("");
    setNewAccessCode("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleDeleteUser = (userId: string) => {
    deleteUser(userId);
    setUsers(getAllUsers());
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start py-12 px-4"
      style={{ background: "oklch(0.975 0.004 85)" }}
    >
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "oklch(0.22 0 0)" }}
          >
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1
            className="font-serif text-3xl font-medium"
            style={{ color: "oklch(0.22 0 0)" }}
          >
            Admin Panel
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <ShieldAlert
              className="w-4 h-4"
              style={{ color: "oklch(0.55 0.18 27)" }}
            />
            <Badge
              variant="destructive"
              className="text-xs font-sans tracking-wider"
            >
              Developer Access Only
            </Badge>
          </div>
        </div>

        {/* Add User Card */}
        <motion.div
          data-ocid="admin.card"
          className="rounded-2xl bg-white p-6 mb-6"
          style={{ boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.07)" }}
        >
          <h2
            className="font-serif text-lg font-medium mb-4"
            style={{ color: "oklch(0.22 0 0)" }}
          >
            Add New Member
          </h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label
                className="font-sans text-sm"
                style={{ color: "oklch(0.35 0.01 85)" }}
              >
                User ID
              </Label>
              <Input
                value={newUserId}
                onChange={(e) => {
                  setNewUserId(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. Member02"
                data-ocid="admin.userid.input"
                className="h-10 font-sans rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                className="font-sans text-sm"
                style={{ color: "oklch(0.35 0.01 85)" }}
              >
                Access Code
              </Label>
              <Input
                value={newAccessCode}
                onChange={(e) => {
                  setNewAccessCode(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. GLOW-772"
                data-ocid="admin.accesscode.input"
                className="h-10 font-sans rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
              />
              {previewCode && (
                <p
                  className="font-sans text-[11px] tracking-wide mt-1"
                  style={{ color: "oklch(0.55 0.04 140)" }}
                >
                  Code will be:{" "}
                  <span className="font-medium">{previewCode}</span>
                </p>
              )}
            </div>

            {/* Tier Selector */}
            <div className="space-y-2">
              <Label
                className="font-sans text-sm"
                style={{ color: "oklch(0.35 0.01 85)" }}
              >
                Access Tier
              </Label>
              <div className="flex gap-2">
                {TIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTierSuffix(opt.value)}
                    data-ocid={`admin.tier${opt.value.toLowerCase()}.toggle`}
                    className="flex-1 flex flex-col items-center gap-0.5 rounded-xl py-2.5 px-2 font-sans transition-all duration-150"
                    style={
                      tierSuffix === opt.value
                        ? {
                            background: "oklch(0.22 0 0)",
                            color: "white",
                            boxShadow: "0 2px 8px oklch(0.22 0 0 / 0.2)",
                          }
                        : {
                            background: "oklch(0.96 0.004 85)",
                            color: "oklch(0.35 0.01 85)",
                            border: "1px solid oklch(0.9 0.006 85)",
                          }
                    }
                    aria-pressed={tierSuffix === opt.value}
                  >
                    <span className="text-[12px] font-semibold tracking-widest">
                      {opt.label}
                    </span>
                    <span
                      className="text-[10px] tracking-wide"
                      style={{
                        color:
                          tierSuffix === opt.value
                            ? "oklch(0.75 0 0)"
                            : "oklch(0.55 0.01 85)",
                      }}
                    >
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  data-ocid="admin.error_state"
                  className="rounded-lg px-4 py-2.5 text-sm font-sans"
                  style={{
                    background: "oklch(0.97 0.02 27)",
                    color: "oklch(0.45 0.2 27)",
                    border: "1px solid oklch(0.85 0.08 27)",
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  role="alert"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.p
                  data-ocid="admin.success_state"
                  className="rounded-lg px-4 py-2.5 text-sm font-sans"
                  style={{
                    background: "oklch(0.95 0.03 140)",
                    color: "oklch(0.35 0.07 140)",
                    border: "1px solid oklch(0.82 0.05 140)",
                  }}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  aria-live="polite"
                >
                  \u2713 User added successfully!
                </motion.p>
              )}
            </AnimatePresence>

            <Button
              type="button"
              onClick={handleAddUser}
              data-ocid="admin.submit_button"
              className="w-full h-10 font-sans rounded-xl gap-2"
              style={{ background: "oklch(0.22 0 0)", color: "white" }}
            >
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          className="rounded-2xl bg-white overflow-hidden"
          style={{ boxShadow: "0 4px 24px 0 oklch(0.22 0 0 / 0.07)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div
            className="px-6 py-4 border-b"
            style={{ borderColor: "oklch(0.92 0.008 85)" }}
          >
            <h2
              className="font-serif text-lg font-medium"
              style={{ color: "oklch(0.22 0 0)" }}
            >
              Members ({users.length})
            </h2>
          </div>

          <Table data-ocid="admin.table">
            <TableHeader>
              <TableRow style={{ borderColor: "oklch(0.92 0.008 85)" }}>
                <TableHead
                  className="font-sans font-medium text-xs uppercase tracking-wider"
                  style={{ color: "oklch(0.5 0.01 85)" }}
                >
                  User ID
                </TableHead>
                <TableHead
                  className="font-sans font-medium text-xs uppercase tracking-wider text-right"
                  style={{ color: "oklch(0.5 0.01 85)" }}
                >
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userId, idx) => (
                <TableRow
                  key={userId}
                  style={{ borderColor: "oklch(0.95 0.004 85)" }}
                >
                  <TableCell
                    className="font-sans font-medium py-3"
                    style={{ color: "oklch(0.22 0 0)" }}
                  >
                    <div className="flex items-center gap-2">
                      {userId}
                      {userId === "Member01" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-sans"
                          style={{
                            background: "oklch(0.88 0.03 140)",
                            color: "oklch(0.35 0.07 140)",
                          }}
                        >
                          seed
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(userId)}
                      disabled={userId === "Member01"}
                      data-ocid={`admin.delete_button.${idx + 1}`}
                      className="h-8 w-8 p-0 rounded-lg hover:bg-red-50 disabled:opacity-30"
                      style={{
                        color:
                          userId === "Member01"
                            ? "oklch(0.7 0 0)"
                            : "oklch(0.55 0.18 27)",
                      }}
                      aria-label={
                        userId === "Member01"
                          ? "Cannot delete seed user"
                          : `Delete user ${userId}`
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="py-10 text-center">
              <p
                className="font-sans text-sm"
                style={{ color: "oklch(0.6 0.01 85)" }}
              >
                No members yet.
              </p>
            </div>
          )}

          <div
            className="px-6 py-3 border-t"
            style={{
              borderColor: "oklch(0.92 0.008 85)",
              background: "oklch(0.975 0.004 85)",
            }}
          >
            <p
              className="text-xs font-sans"
              style={{ color: "oklch(0.65 0.008 85)" }}
            >
              Note: Member01 cannot be deleted (protected seed user).
            </p>
          </div>
        </motion.div>

        {/* Back to portal link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-sm font-sans underline underline-offset-2 hover:opacity-70 transition-opacity"
            style={{ color: "oklch(0.5 0.01 85)" }}
          >
            \u2190 Back to Portal
          </a>
        </div>
      </motion.div>
    </div>
  );
}
