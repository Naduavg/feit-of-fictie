// Tab wisselaar
function openPage(pageName, elmnt) {

  // Verberg alle tabbladen
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Reset alle tabknoppen
  const tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].classList.remove("active");
  }

  // Toon geselecteerd tabblad
  const selectedTab = document.getElementById(pageName);
  if (selectedTab) {
    selectedTab.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Markeer actieve knop
  if (elmnt) {
    elmnt.classList.add("active");
  }
}

// Pagina standaard starten met home
document.addEventListener("DOMContentLoaded", function () {
  const defaultOpen = document.getElementById("defaultOpen");
  const homeTab = document.getElementById("home");

  if (defaultOpen) {
    defaultOpen.click();
  } else if (homeTab) {
    // Safe fallback if the default button isn't present
    homeTab.style.display = "block";
  }
});
