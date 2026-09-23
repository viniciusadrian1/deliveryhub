ALTER TABLE "expense" ADD COLUMN "employee_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "expense" ADD CONSTRAINT "expense_employee_count_check" CHECK ("employee_count" BETWEEN 1 AND 10000);
