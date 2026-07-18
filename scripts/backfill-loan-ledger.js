const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function loanType(direction) {
  return direction === "TAKEN" ? "INCOME" : "EXPENSE";
}

function repaymentType(direction) {
  return direction === "GIVEN" ? "INCOME" : "EXPENSE";
}

function loanNote(loan) {
  const action = loan.direction === "TAKEN" ? "Loan taken from" : "Loan given to";
  return [action, loan.personName, loan.note ? `- ${loan.note}` : ""].filter(Boolean).join(" ");
}

function repaymentNote(loan, payment) {
  const action =
    loan.direction === "GIVEN" ? "Loan repayment received from" : "Loan repayment paid to";
  return [action, loan.personName, payment.note ? `- ${payment.note}` : ""]
    .filter(Boolean)
    .join(" ");
}

async function main() {
  const loans = await prisma.loan.findMany({ include: { payments: true } });
  let created = 0;

  await prisma.transaction.updateMany({
    where: { account: null },
    data: { account: "CASH" },
  });

  for (const loan of loans) {
    const account = loan.account || "CASH";
    let transactionId = loan.transactionId;

    if (!transactionId) {
      const transaction = await prisma.transaction.create({
        data: {
          userId: loan.userId,
          type: loanType(loan.direction),
          amount: loan.principal,
          category: "Loan",
          account,
          note: loanNote(loan),
          date: loan.date,
        },
      });
      transactionId = transaction.id;
      created += 1;
    }

    await prisma.loan.update({
      where: { id: loan.id },
      data: { account, transactionId },
    });

    for (const payment of loan.payments) {
      const paymentAccount = payment.account || "CASH";
      let paymentTransactionId = payment.transactionId;

      if (!paymentTransactionId) {
        const transaction = await prisma.transaction.create({
          data: {
            userId: loan.userId,
            type: repaymentType(loan.direction),
            amount: payment.amount,
            category: "Loan",
            account: paymentAccount,
            note: repaymentNote(loan, payment),
            date: payment.date,
          },
        });
        paymentTransactionId = transaction.id;
        created += 1;
      }

      await prisma.loanPayment.update({
        where: { id: payment.id },
        data: { account: paymentAccount, transactionId: paymentTransactionId },
      });
    }
  }

  const [loansWithoutTransaction, paymentsWithoutTransaction, transactionsWithoutAccount] =
    await Promise.all([
      prisma.loan.count({ where: { transactionId: null } }),
      prisma.loanPayment.count({ where: { transactionId: null } }),
      prisma.transaction.count({ where: { account: null } }),
    ]);

  console.log(`Loan ledger synchronized. Created ${created} missing transaction(s).`);
  console.log(
    JSON.stringify({
      loansWithoutTransaction,
      paymentsWithoutTransaction,
      transactionsWithoutAccount,
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
