import { supabase } from "./supabase.js";

const transactionForm = document.getElementById('transaction-form');
const txTypeInput = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txDescInput = document.getElementById('tx-desc');

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = txTypeInput.value;
    const category = txCategoryInput.value;
    const amount = Number(txAmountInput.value);
    const date = txDateInput.value;
    const desc = txDescInput.value;

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
        window.location.href = 'index.html';
        return;
    }

    const { data, error } = await supabase
        .from('transactions')
        .insert([
            {
                user_id: user.id,
                type: type,
                category: category,
                amount: amount,
                description: desc,
                date: date
            }
        ])
        .select();

    if (error) {
        alert(`Гүйлгээг хадгалахад алдаа гарлаа: ${error.message}`);
        console.error("Алдааны дэлгэрэнгүй:", error);
        return;
    }

    alert("Гүйлгээ амжилттай бүртгэгдлээ");
    transactionForm.reset();
    console.log(data);

    fetchTransactions();
});

async function fetchTransactions() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return;
    }

    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    console.log(transactions);
    renderTransactions(transactions);
}

function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');

    if (transactions.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fa-solid fa-folder-open fs-3 d-block mb-2"></i>
                    Одоогоор ямар нэгэн гүйлгээ бүртгэгдээгүй байна.
                </td>
            </tr>
        `;
        return;
    }

    let htmlContent = '';

    transactions.forEach(tx => {
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>

                <td>
                    <span class="badge bg-light text-dark shadow-sm border">
                        ${tx.category}
                    </span>
                </td>

                <td class="text-secondary fw-medium">
                    ${tx.description}
                </td>

                <td>
                    <span class="badge ${badgeColor}">
                        ${typeText}
                    </span>
                </td>

                <td class="text-end fw-bold ${amountColor}">
                    ${amountSign}${Number(tx.amount).toLocaleString()} ₮
                </td>

                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    listContainer.innerHTML = htmlContent;
}

window.deleteTransaction = async function (id) {
    const confirmDelete = confirm("Энэ гүйлгээг устгах уу?");

    if (!confirmDelete) {
        return;
    }

    const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

    if (error) {
        alert(`Гүйлгээ устгахад алдаа гарлаа: ${error.message}`);
        console.error("Устгах алдаа:", error);
        return;
    }

    alert("Гүйлгээ амжилттай устлаа");
    fetchTransactions();
};

fetchTransactions();