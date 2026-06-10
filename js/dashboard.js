// supabase холболтоо импортлож оруулж ирнэ
import { supabase } from './supabase.js'

// Дэлгэц дээрх HTML элементүүдийг JS хувьсагчид оноож авах
const transactionForm = document.getElementById('transaction-form');
const txTypeInput = document.getElementById('tx-type');
const txCategoryInput = document.getElementById('tx-category');
const txAmountInput = document.getElementById('tx-amount');
const txDateInput = document.getElementById('tx-date');
const txDescInput = document.getElementById('tx-desc');

// Хуудас бэлэн болж, ачаалагдаж дуусах үед ажиллах хэсэг
document.addEventListener('DOMContentLoaded', async () => {
    
    // Хамгийн түрүүнд хэрэглэгч нэвтэрсэн эсэхийг шалгана
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        // Хэрэв нэвтрээгүй байвал шууд нэвтрэх хуудас руу буцаана
        window.location.href = 'index.html';
        return;
    }

    // Хэрэглэгч нэвтэрсэн нь үнэн бол имэйлийг нь navbar дээр харуулна
    document.getElementById('user-email').textContent = user.email;

    // Хуудас нээгдэх үед өмнөх гүйлгээний түүхийг шалгаад авах ёстой шагналыг автоматаар олгоно
    await syncExistingBadges((await supabase.auth.getUser()).data.user);
    await fetchTransactions();
    await fetchBudgets();
    await fetchBadges();
    });

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Хуудас Refresh хийгдэхийг зогсооно

    // Талбаруудаас хэрэглэгчийн оруулсан утгуудыг уншиж авах
    const type = txTypeInput.value;
    const category = txCategoryInput.value;
    const amount = parseFloat(txAmountInput.value); // Текстийг тоо болгож хөрвүүлнэ
    const date = txDateInput.value;
    const description = txDescInput.value;

    // Гүйлгээ нэмэх гэж буй нэвтэрсэн хэрэглэгчийн мэдээллийг Supabase-ээс авах
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    // console.log(user)

    if (userError || !user) {
        alert("Сешн дууссан байна. Дахин нэвтэрнэ үү!");
        window.location.href = 'index.html';
        return;
    }

// --- (Формын утгуудыг авсны дараа, Insert хийхийн өмнөх хэсэг) ---
    let isBudgetExceeded = false;
    // Хэрэв хийж буй гүйлгээ нь ЗАРЛАГА бол ТӨСӨВ ХЭТЭРСЭН ЭСЭХИЙГ ШАЛГАНА
    if (type === 'expense') {
        // Тухайн гүйлгээний огнооноос Жил-Сарыг салгаж авна (Жишээ нь: "2026-06-08" -> "2026-06")
        const currentMonthYear = date.substring(0, 7);

        // Supabase-ээс энэ сард, энэ ангилалд тогтоосон төсөв байгаа эсэхийг хайх
        const { data: budgetData } = await supabase
            .from('budgets')
            .select('limit_amount')
            .eq('user_id', user.id)
            .eq('category', category)
            .eq('month_year', currentMonthYear)
            .maybeSingle(); // Олдвол ганцхан объект авна, олдохгүй бол null

        // Хэрэв энэ сард энэ ангилалд зориулсан төсөв байхгүй бол хэрэглэгчээс лавлаж асууна
        if (!budgetData) {
            const proceedWithoutBudget = confirm(
                `⚠️ ТӨСӨВ ТОГТООГООГҮЙ БАЙНА!\n\n` +
                `Ангилал: ${category}\n` +
                `Сар: ${currentMonthYear}\n\n` +
                `Энэ ангилалд төсөв бүртгээгүй байна.\n` +
                `Гүйлгээг үргэлжлүүлж хийх үү?\n\n` +
                `OK = Гүйлгээ хийх\n` +
                `Cancel = Болих`
            );

            if (!proceedWithoutBudget) {
                alert("Гүйлгээ цуцлагдлаа. Төсөв тогтоогоогүй тул хадгалаагүй.");
                return;
            }
        } else {
            const limitAmount = Number(budgetData.limit_amount);

            // Энэ сард, энэ ангилалд урьд нь хийгдсэн бүх зарлагуудын нийлбэрийг Supabase-с татах
            const { data: pastExpenses, error: pastExpenseError } = await supabase
                .from('transactions')
                .select('amount, date')
                .eq('user_id', user.id)
                .eq('type', 'expense')
                .eq('category', category);

            if (pastExpenseError) {
                alert("Өмнөх зарлагуудыг шалгахад алдаа гарлаа: " + pastExpenseError.message);
                return;
            }
            
            // Энэ сард хамаарах зарлагуудыг шүүж нийлбэрийг олно
            let totalPastExpense = 0;
            if (pastExpenses) {
                pastExpenses.forEach(tx => {
                    // Гүйлгээ бүрийн огноо нь энэ сард хамааралтай эсэхийг шалгах
                    if (tx.date && tx.date.substring(0, 7) === currentMonthYear) {
                        totalPastExpense += Number(tx.amount);
                    }
                });
            }

            // Хуучин зарлагууд дээр ОДООНЫ ШИНЭ зарлагын дүнг нэмээд лимитээс давж байгааг шалгах
            if (totalPastExpense + amount > limitAmount) {
                isBudgetExceeded = true;
                const currentTotal = totalPastExpense + amount;
                const overAmount = currentTotal - limitAmount;
                const beforeRemaining = limitAmount - totalPastExpense;

                const proceed = confirm(
                    `⚠️ ТӨСӨВ ХЭТЭРЛЭЭ!\n\n` +
                    `Ангилал: ${category}\n` +
                    `Сар: ${currentMonthYear}\n\n` +
                    `Таны төсөв: ${limitAmount.toLocaleString()} ₮\n` +
                    `Одоогийн үлдэгдэл төсөв: ${beforeRemaining.toLocaleString()} ₮\n` +
                    `Оруулах гэж буй гүйлгээ: ${amount.toLocaleString()} ₮\n\n` +
                    `Энэ гүйлгээг хийвэл нийт зарцуулалт: ${currentTotal.toLocaleString()} ₮ болно.\n` +
                    `Төсвөөс хэтэрсэн дүн: ${overAmount.toLocaleString()} ₮\n\n` +
                    `Гүйлгээг үргэлжлүүлж хийх үү?\n\n`
                );
                
                if (!proceed) {
                    alert("Гүйлгээ цуцлагдлаа. Төсөв хэтэрсэн тул хадгалаагүй.");
                    return;
                }
            }
        }
    }

    // Supabase руу шинэ мөр өгөгдөл нэмэх (Insert) үйлдэл
    const { data, error } = await supabase
        .from('transactions') // Хэрэглэх хүснэгтийн нэр
        .insert([
            {
                user_id: user.id,        // UUID
                type: type,              // 'орлого' эсвэл 'зарлага'
                category: category,      // 'Хоол хүнс', 'Цалин орлого' гэх мэт текст
                amount: amount,          // Мөнгөн дүн (Тоо)
                description: description,// Дэлгэрэнгүй тайлбар
                date: date               // Сонгосон огноо (YYYY-MM-DD)
            }
        ])
        .select(); // Хадгалагдсан өгөгдлийг хариу болгож буцааж авах

    if (error) {
        alert("Гүйлгээг хадгалахад алдаа гарлаа: " + error.message);
        console.error("Алдааны дэлгэрэнгүй:", error);
    } else {
    alert("Гүйлгээ амжилттай бүртгэгдлээ!");

    await checkBadges(user, {
    type: type,
    category: category,
    amount: amount,
    date: date
}, isBudgetExceeded);

    await fetchBadges();

    transactionForm.reset(); // Формын бүх талбарыг цэвэрлэж хоосон болгоно
}
    // Гүйлгээ нэмэгдсэний дараа хүснэгт болон төсвийн үлдэгдлийг шинэчилнэ
    await fetchTransactions();
    await fetchBudgets();
});

// Өгөгдлийн сангаас гүйлгээ уншиж, хүснэгтэд харуулах функц
async function fetchTransactions() {
    // Нэвтэрсэн хэрэглэгчийг авах
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Supabase-с зөвхөн энэ хэрэглэгчийн гүйлгээнүүдийг огноогоор нь жагсааж авах
    const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*') // Бүх баганыг уншиж авна
        .eq('user_id', user.id) // Зөвхөн энэ хэрэглэгчийнх гэсэн шүүлтүүр
        .order('date', { ascending: false }); // Хамгийн шинэ гүйлгээг дээр нь гаргана

    if (error) {
        console.error("Гүйлгээ уншихад алдаа гарлаа:", error.message);
        return;
    }

    // Мөнгөн дүнг тооцоолох хэсэг
    let totalIncome = 0;
    let totalExpense = 0;

    // Ирсэн бүх гүйлгээнүүдийг нэг нэгээр нь шалгаж, орлого зарлагыг нэмнэ
    transactions.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amount;  // Хэрэв орлого бол Нийт Орлого дээр нэмнэ
        } else if (tx.type === 'expense') {
            totalExpense += tx.amount; // Хэрэв зарлага бол Нийт зарлага дээр нэмнэ
        }
    });

    // Үлдэгдэл баланс = Нийт Орлого - Нийт Зарлага
    const totalBalance = totalIncome - totalExpense;

    // Бодсон дүнг HTML карт руу бичих
    document.getElementById('total-balance').textContent = `${totalBalance.toLocaleString()} ₮`;
    document.getElementById('total-income').textContent = `${totalIncome.toLocaleString()} ₮`;
    document.getElementById('total-expense').textContent = `${totalExpense.toLocaleString()} ₮`;

    // HTML хүснэгтэд гүйлгээнүүдийг үзүүлэх функцыг дуудаж, өгөгдлийг дамжуулна
    renderTransactions(transactions);
}

function renderTransactions(transactions) {
    const listContainer = document.getElementById('transaction-list');
    
    // Хэрэв ямар ч гүйлгээ байхгүй бол хоосон байна гэсэн бичиг харуулна
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

    // Хүснэгтийг цэвэрлээд, датаг мөр мөрөөр нь залгах
    let htmlContent = '';
    
    transactions.forEach(tx => {
        // Орлого бол ногоон +, Зарлага бол улаан - тэмдэг тавих логик
        const isIncome = tx.type === 'income';
        const badgeColor = isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
        const typeText = isIncome ? 'Орлого' : 'Зарлага';
        const amountSign = isIncome ? '+' : '-';
        const amountColor = isIncome ? 'text-success' : 'text-danger';

        htmlContent += `
            <tr>
                <td>${tx.date}</td>
                <td><span class="badge bg-light text-dark shadow-sm border">${tx.category}</span></td>
                <td class="text-secondary fw-medium">${tx.description}</td>
                <td><span class="badge ${badgeColor}">${typeText}</span></td>
                <td class="text-end fw-bold ${amountColor}">${amountSign}${tx.amount.toLocaleString()} ₮</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteTransaction('${tx.id}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    // Бэлдсэн  HTML мөрүүдээ хүснэгтийн tbody руу шууд шахаж оруулна
    listContainer.innerHTML = htmlContent;
}

// Гүйлгээ устгах функц (Дэлгэц дээрх устгах товч дарагдахад ажиллана)
window.deleteTransaction = async function(id) {
    // Хэрэглэгчээс үнэхээр устгах эсэхийг нь лавлаж асууна
    const confirmDelete = confirm("Та энэ гүйлгээг устгахдаа итгэлтэй байна уу?");
    
    if (!confirmDelete) {
        return; // Хэрэв "Үгүй" гэвэл устгах үйлдлийг цуцалж, функцээс гарна
    }

    try {
        // Supabase өгөгдлийн сангаас тухайн ID-тай гүйлгээг устгах
        const { error } = await supabase
            .from('transactions')
            .delete() // SQL-ийн DELETE команд
            .eq('id', id); // Зөвхөн энэ ID-тай мөрийг устга гэдэг шүүлтүүр

        if (error) {
            throw error; // Хэрэв алдаа гарвал catch хэсэг рүү шиднэ
        }

        alert("Гүйлгээ амжилттай устгагдлаа.");

        // Устгасны дараа дэлгэц дээрх хүснэгт, төсөв болон шагналын жагсаалтыг шинэчилж харуулна
        await syncExistingBadges((await supabase.auth.getUser()).data.user);
        await fetchTransactions();
        await fetchBudgets();
        await fetchBadges();

    } catch (error) {
        alert("Гүйлгээ устгахад алдаа гарлаа: " + error.message);
        console.error("Устгах үеийн алдаа:", error);
    }
}

// HTML дээрх "Гарах" товч ID-аар нь барьж авах
const btnLogout = document.getElementById('btn-logout');

// Товч дээр дарах үед ажиллах Event Listener залгах
btnLogout.addEventListener('click', async () => {
    // Хэрэглэгчээс үнэхээр гарах эсэхийг нь лавлаж асууна
    const confirmLogout = confirm("Та системээс гарахдаа итгэлтэй байна уу?");
    
    if (!confirmLogout) {
        return; // Хэрэв цуцалбал гарах үйлдлийг зогсооно
    }

    try {
        // Supabase-ийн системээс бүрмөсөн гаргах, сешн устгах тушаал
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error; // Хэрэв алдаа гарвал catch хэсэг рүү шиднэ
        }

        // Амжилттай гарсан тул нэвтрэх хуудас руу шууд шилжүүлнэ
        window.location.href = 'index.html';

    } catch (error) {
        alert("Системээс гарахад алдаа гарлаа: " + error.message);
        console.error("Logout алдаа:", error);
    }
});



// --- ТӨСӨВ ТОГТООХ ФОРМЫН ЛОГИК ---
const budgetForm = document.getElementById('budget-form');
const budgetCategoryInput = document.getElementById('budget-category');
const budgetAmountInput = document.getElementById('budget-amount');
const budgetMonthInput = document.getElementById('budget-month');

budgetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Формоос өгөгдөл уншиж авах
    const category = budgetCategoryInput.value;
    const limitAmount = parseFloat(budgetAmountInput.value);
    const monthYear = budgetMonthInput.value; 
    // Нэвтэрсэн хэрэглэгчийг шалгах
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Сешн дууссан байна!");
        return;
    }

    // Supabase-ийн 'budgets' хүснэгт рүү хадгалах
    const { error } = await supabase
        .from('budgets')
        .insert([
            {
                user_id: user.id,
                category: category,
                limit_amount: limitAmount,
                month_year: monthYear
            }
        ]);

    if (error) {
        alert("Төсөв тогтооход алдаа гарлаа: " + error.message);
    } else {
        alert(`${monthYear} сарын ${category} ангилалд төсөв амжилттай тогтоогдлоо!`);
        budgetForm.reset();
        
        // Bootstrap Offcanvas цэсийг автоматаар хаах код
        const instance = bootstrap.Offcanvas.getInstance(document.getElementById('offcanvasBudget'));
        if (instance) instance.hide();
        
        // Төсвийн жагсаалтыг шинэчилнэ
        await fetchBudgets();
    }
});
// --- ӨМНӨХ ГҮЙЛГЭЭНИЙ ТҮҮХИЙГ ШАЛГАЖ ШАГНАЛ АВТОМАТААР ОЛГОХ ФУНКЦ ---
// --- ӨМНӨХ ГҮЙЛГЭЭНИЙ ТҮҮХИЙГ ШАЛГАЖ ШАГНАЛ АВТОМАТААР ОЛГОХ ФУНКЦ ---
async function syncExistingBadges(user) {
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

    if (txError) {
        console.error("Өмнөх гүйлгээнүүдийг шалгахад алдаа:", txError.message);
        return;
    }

    const { data: existingBadges, error: badgeError } = await supabase
        .from('badges')
        .select('id, badge_name')
        .eq('user_id', user.id);

    if (badgeError) {
        console.error("Өмнөх шагналуудыг шалгахад алдаа:", badgeError.message);
        return;
    }

    const transactionList = transactions || [];
    const transactionCount = transactionList.length;
    let earnedBadges = [];

    // Хэрвээ гүйлгээ огт байхгүй бол өмнөх бүх шагналыг устгана
    if (transactionCount === 0) {
        if (existingBadges && existingBadges.length > 0) {
            const badgeIdsToDelete = existingBadges.map(b => b.id);

            const { error: deleteError } = await supabase
                .from('badges')
                .delete()
                .in('id', badgeIdsToDelete);

            if (deleteError) {
                console.error("Гүйлгээ байхгүй үед шагнал устгахад алдаа:", deleteError.message);
            }
        }
        return;
    }

    // Нийт гүйлгээний тоогоор авах шагнал
    if (transactionCount >= 5) {
        earnedBadges.push("🥉 Эхлэгч санхүүч");
    }

    if (transactionCount >= 10) {
        earnedBadges.push("🥈 Санхүүгээ хянагч");
    }

    if (transactionCount >= 20) {
        earnedBadges.push("🥇 Мөнгөний мастер");
    }

    // 100,000₮+ орлого байсан эсэх
    const hasBigIncome = transactionList.some(tx =>
        tx.type === 'income' && Number(tx.amount) >= 100000
    );

    if (hasBigIncome) {
        earnedBadges.push("💰 Орлогын аварга");
    }

    // Төсөвтэй холбоотой шагнал шалгах
    const { data: budgets, error: budgetError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id);

    if (!budgetError) {
        const budgetList = budgets || [];
        let hasSafeBudgetExpense = false;
        let hasResponsibleExpense = false;

        budgetList.forEach(budget => {
            const monthYear = budget.month_year;
            const category = budget.category;
            const limitAmount = Number(budget.limit_amount);

            const monthExpenses = transactionList.filter(tx =>
                tx.type === 'expense' &&
                tx.category === category &&
                tx.date &&
                tx.date.substring(0, 7) === monthYear
            );

            const spentAmount = monthExpenses.reduce((sum, tx) => {
                return sum + Number(tx.amount);
            }, 0);

            if (monthExpenses.length > 0 && spentAmount <= limitAmount) {
                hasSafeBudgetExpense = true;
            }

            const hasBigExpense = monthExpenses.some(tx => Number(tx.amount) >= 50000);

            if (hasBigExpense && spentAmount <= limitAmount) {
                hasResponsibleExpense = true;
            }
        });

        if (hasSafeBudgetExpense) {
            earnedBadges.push("🛡️ Төсвийн сахиул");
        }

        if (hasResponsibleExpense) {
            earnedBadges.push("✅ Хариуцлагатай зарлага");
        }
    }

    const alreadyEarned = existingBadges
        ? existingBadges.map(b => b.badge_name)
        : [];

    // Одоо авах ёсгүй болсон шагналуудыг устгана
    const badgesToDelete = existingBadges
        ? existingBadges.filter(b => !earnedBadges.includes(b.badge_name))
        : [];

    if (badgesToDelete.length > 0) {
        const badgeIdsToDelete = badgesToDelete.map(b => b.id);

        const { error: deleteError } = await supabase
            .from('badges')
            .delete()
            .in('id', badgeIdsToDelete);

        if (deleteError) {
            console.error("Хүчингүй болсон шагнал устгахад алдаа:", deleteError.message);
        }
    }

    // Шинээр авах ёстой шагналуудыг нэмнэ
    const badgesToInsert = earnedBadges
        .filter(badgeName => !alreadyEarned.includes(badgeName))
        .map(badgeName => ({
            user_id: user.id,
            badge_name: badgeName,
            awarded_at: new Date().toISOString()
        }));

    if (badgesToInsert.length === 0) {
        return;
    }

    const { error: insertError } = await supabase
        .from('badges')
        .insert(badgesToInsert);

    if (insertError) {
        console.error("Өмнөх гүйлгээний түүхээс шагнал олгоход алдаа:", insertError.message);
        return;
    }

    alert(
        "🎉 ГҮЙЛГЭЭНИЙ ТҮҮХЭЭС ШИНЭ ШАГНАЛ АВЛАА!\n\n" +
        badgesToInsert.map(b => b.badge_name).join("\n")
    );
}

// --- АВСАН ШАГНАЛУУДЫГ УНШИЖ ХАРУУЛАХ ФУНКЦ ---
async function fetchBadges() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const badgesContainer = document.getElementById('badges-list');
    if (!badgesContainer) return;

    const { data: badges, error } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', user.id)
        .order('awarded_at', { ascending: false });

    if (error) {
        console.error("Шагнал уншихад алдаа гарлаа:", error.message);
        badgesContainer.innerHTML = `
            <div class="alert alert-danger small">
                Шагнал уншихад алдаа гарлаа: ${error.message}
            </div>
        `;
        return;
    }

    if (!badges || badges.length === 0) {
        badgesContainer.innerHTML = `
            <div class="text-center py-4 text-muted small bg-light rounded">
                <i class="fa-solid fa-award fs-3 d-block mb-2"></i>
                Одоогоор шагнал аваагүй байна.
            </div>
        `;
        return;
    }

    let htmlContent = `
        <div class="alert alert-warning small fw-bold">
            Нийт авсан шагнал: ${badges.length}
        </div>
    `;

    badges.forEach(badge => {
        const awardedDate = badge.awarded_at
            ? new Date(badge.awarded_at).toLocaleDateString('mn-MN')
            : '';

        htmlContent += `
            <div class="card border-0 shadow-sm mb-3 bg-light">
                <div class="card-body d-flex align-items-center gap-3">
                    <div class="fs-2">
                        <i class="fa-solid fa-trophy text-warning"></i>
                    </div>
                    <div>
                        <div class="fw-bold text-dark">${badge.badge_name}</div>
                        <div class="text-muted small">Авсан огноо: ${awardedDate}</div>
                    </div>
                </div>
            </div>
        `;
    });

    badgesContainer.innerHTML = htmlContent;
}
// --- BADGES / ШАГНАЛ ЦОЛ ОЛГОХ ФУНКЦ ---
async function checkBadges(user, newTransaction, isBudgetExceeded) {
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id);

    if (txError) {
        console.error("Гүйлгээний тоо шалгахад алдаа:", txError.message);
        return;
    }

    const { data: existingBadges, error: badgeError } = await supabase
        .from('badges')
        .select('badge_name')
        .eq('user_id', user.id);

    if (badgeError) {
        console.error("Badge уншихад алдаа:", badgeError.message);
        alert("Badge уншихад алдаа гарлаа: " + badgeError.message);
        return;
    }

    const alreadyEarned = existingBadges
        ? existingBadges.map(b => b.badge_name)
        : [];

    const transactionCount = transactions ? transactions.length : 0;
    let newBadges = [];

    if (transactionCount >= 5) {
        newBadges.push("🥉 Эхлэгч санхүүч");
    }

    if (transactionCount >= 10) {
        newBadges.push("🥈 Санхүүгээ хянагч");
    }

    if (transactionCount >= 20) {
        newBadges.push("🥇 Мөнгөний мастер");
    }

    if (newTransaction.type === 'expense' && !isBudgetExceeded) {
        newBadges.push("🛡️ Төсвийн сахиул");
    }

    if (newTransaction.type === 'income' && Number(newTransaction.amount) >= 100000) {
        newBadges.push("💰 Орлогын аварга");
    }

    if (
        newTransaction.type === 'expense' &&
        Number(newTransaction.amount) >= 50000 &&
        !isBudgetExceeded
    ) {
        newBadges.push("✅ Хариуцлагатай зарлага");
    }

    const badgesToInsert = newBadges
        .filter(badgeName => !alreadyEarned.includes(badgeName))
        .map(badgeName => ({
            user_id: user.id,
            badge_name: badgeName,
            awarded_at: new Date().toISOString()
        }));

    if (badgesToInsert.length === 0) {
        return;
    }

    const { error: insertError } = await supabase
        .from('badges')
        .insert(badgesToInsert);

    if (insertError) {
        console.error("Badge хадгалахад алдаа:", insertError.message);
        alert("Badge хадгалахад алдаа гарлаа: " + insertError.message);
        return;
    }

    alert(
        "🎉 ШИНЭ ШАГНАЛ АВЛАА!\n\n" +
        badgesToInsert.map(b => b.badge_name).join("\n")
    );
}


// Хэрэглэгчийн тогтоосон төсвүүдийг уншиж, Offcanvas доор жагсаах функц
async function fetchBudgets() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Хэрэглэгчийн тогтоосон бүх төсвийг авна
    const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .order('month_year', { ascending: false });

    if (error) {
        console.error("Төсөв уншихад алдаа гарлаа:", error.message);
        return;
    }

    const budgetsContainer = document.getElementById('current-budgets-list');
    
    if (!budgets || budgets.length === 0) {
        budgetsContainer.innerHTML = `
            <h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>
            <div class="text-center py-3 text-muted small bg-light rounded">Одоогоор төсөв тогтоогоогүй байна.</div>
        `;
        return;
    }

    let htmlContent = `<h6 class="fw-bold text-dark mb-3">Одоогийн тогтоосон төсвүүд:</h6>`;
    
    // 2. Төсөв бүр дээр тухайн сар, тухайн ангиллын зарлагыг бодож үлдэгдлийг гаргана
    for (const b of budgets) {
        const monthYear = b.month_year; // Жишээ: 2026-06
        const startDate = `${monthYear}-01`;

        // Дараагийн сарын эхний өдрийг гаргана
        const [year, month] = monthYear.split('-').map(Number);
        const nextMonth = new Date(year, month, 1);
        const nextMonthYear = nextMonth.toISOString().substring(0, 10);

        // 3. Энэ budget-ийн category болон month_year дээр таарах зарлагуудыг авна
        const { data: expenses, error: expenseError } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user.id)
            .eq('type', 'expense')
            .eq('category', b.category)
            .gte('date', startDate)
            .lt('date', nextMonthYear);

        if (expenseError) {
            console.error("Зарлага уншихад алдаа гарлаа:", expenseError.message);
            continue;
        }

        // 4. Тухайн сарын тухайн ангиллын зарлагын нийлбэр
        let spentAmount = 0;
        if (expenses) {
            expenses.forEach(tx => {
                spentAmount += Number(tx.amount);
            });
        }

        // 5. Үлдэгдэл төсөв
        const limitAmount = Number(b.limit_amount);
        const remainingAmount = limitAmount - spentAmount;

        // 6. Зарцуулалтын хувь
        const percentUsed = limitAmount > 0
            ? Math.min((spentAmount / limitAmount) * 100, 100)
            : 0;

        // 7. Төлөв болон өнгө
        let progressColor = 'bg-success';
        let statusText = 'Хэвийн';
        let remainingColor = 'text-success';

        if (remainingAmount < 0) {
            progressColor = 'bg-danger';
            statusText = 'Хэтэрсэн';
            remainingColor = 'text-danger';
        } else if (percentUsed >= 80) {
            progressColor = 'bg-warning';
            statusText = 'Анхаарах';
            remainingColor = 'text-warning';
        }

        htmlContent += `
            <div class="card p-3 mb-3 bg-light border-0 shadow-sm">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <span class="fw-bold text-dark">${b.category}</span>
                        <span class="text-muted mx-1">•</span>
                        <span class="small text-secondary">${b.month_year}</span>
                    </div>
                    <span class="badge ${remainingAmount < 0 ? 'bg-danger' : 'bg-success'}">
                        ${statusText}
                    </span>
                </div>

                <div class="small text-secondary mb-1">
                    Төсөв: <b>${limitAmount.toLocaleString()} ₮</b>
                </div>

                <div class="small text-secondary mb-1">
                    Зарцуулсан: <b class="text-danger">${spentAmount.toLocaleString()} ₮</b>
                </div>

                <div class="small mb-2">
                    Үлдэгдэл: 
                    <b class="${remainingColor}">${remainingAmount.toLocaleString()} ₮</b>
                </div>

                <div class="progress" style="height: 8px;">
                    <div 
                        class="progress-bar ${progressColor}" 
                        style="width: ${percentUsed}%;">
                    </div>
                </div>
            </div>
        `;
    }

    budgetsContainer.innerHTML = htmlContent;
}