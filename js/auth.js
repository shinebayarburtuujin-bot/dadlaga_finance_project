import { supabase } from "./supabase.js";

const authForm      = document.getElementById('auth-form');
const emailInput    = document.getElementById('email');
const passwordInput = document.getElementById('password');
const btnRegister   = document.getElementById('btn-register');
const messageDiv    = document.getElementById('message');

// БҮРТГҮҮЛЭХ
btnRegister.addEventListener('click', async (e) => {
    e.preventDefault(); // энэ заавал хэрэгтэй

    console.log("Бүртгүүлэх товч дарагдлаа.");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Имэйл болон нууц үгээ хийнэ үү!", "text-danger");
        return;
    }

    if (password.length < 6) {
        showMessage("Нууц үг доод тал нь 6 тэмдэгт байх ёстой!", "text-danger");
        return;
    }

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
    });

    if (error) {
        showMessage(`Бүртгэл амжилтгүй: ${error.message}`, "text-danger");
        return;
    }

    showMessage("Бүртгэл амжилттай! Одоо нэвтэрнэ үү.", "text-success");
});

// НЭВТРЭХ
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    console.log("Нэвтрэх товч дарагдлаа.");

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage("Имэйл болон нууц үгээ оруулна уу!", "text-danger");
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showMessage(`Нэвтрэх алдаа: ${error.message}`, "text-danger");
        return;
    }

    showMessage("Амжилттай нэвтэрлээ!", "text-success");

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1500);
});

function showMessage(text, bootstrapColorClass) {
    messageDiv.innerText = text;
    messageDiv.className = `text-center small mt-3 fw-medium ${bootstrapColorClass}`;
}