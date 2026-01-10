// Algemene tab wisselaar
function openPage(pageName, elmnt, color) {

  // Verberg alle tabbladen
  const tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }

  // Reset alle tabknoppen
  const tablinks = document.getElementsByClassName("tablink");
  for (let i = 0; i < tablinks.length; i++) {
    tablinks[i].style.backgroundColor = "";
    tablinks[i].classList.remove("active");
  }

  // Toon geselecteerd tabblad
  const selectedTab = document.getElementById(pageName);
  if (selectedTab) selectedTab.style.display = "block";

  // Active knop instellen
  if (elmnt) {
    elmnt.style.backgroundColor = color;
    elmnt.classList.add("active");
  }

  // Reset fotografie tab
  if (pageName === "fotografie") {
    resetFotografieTab();
  }

  // Verberg alle sub-content
  hideAllSubContent();
}

// Pagina standaard starten met home
window.onload = function () {
  document.getElementById("defaultOpen").click();
};
