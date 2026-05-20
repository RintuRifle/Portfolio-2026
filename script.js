const handle = "RintuRifle";
const ghUsername = "RintuRifle";

// ── Supabase Config ──────────────────────────────────────────────
const SUPABASE_URL = 'https://koggdnslelupnbypesql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Kwm7KP_WSq9QLieiUfWqaA_B3lZ6Gic';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Shared Calendar Heatmap renderLogic ---
function renderCalendar(gridId, monthLabelId, yearLabelId, endYear, endMonth, calendarData, titleFormatter) {
  const calendarGrid = document.getElementById(gridId);
  const monthLabel = document.getElementById(monthLabelId);
  const yearLabel = document.getElementById(yearLabelId);

  if (!calendarGrid) return;
  calendarGrid.innerHTML = "";

  const endDate = new Date(endYear, endMonth + 1, 0); // Last day of endMonth
  const startDate = new Date(endYear, endMonth - 5, 1); // First day of 6 months ago

  if (monthLabel) {
    const startStr = startDate.toLocaleString('default', { month: 'short' });
    const endStr = endDate.toLocaleString('default', { month: 'short' });
    monthLabel.textContent = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  }
  if (yearLabel) {
    yearLabel.textContent = (startDate.getFullYear() !== endDate.getFullYear()) 
                          ? `${startDate.getFullYear()} / ${endDate.getFullYear()}` 
                          : endDate.getFullYear();
  }

  // Find the exact Sunday before or on startDate to align columns
  const startOffset = startDate.getDay();
  const alignedStartDate = new Date(startDate);
  alignedStartDate.setDate(alignedStartDate.getDate() - startOffset);

  // We need enough weeks to reach endDate
  const msInDay = 86400 * 1000;
  // Calculate difference strictly using UTC to avoid daylight saving issues
  const utc1 = Date.UTC(alignedStartDate.getFullYear(), alignedStartDate.getMonth(), alignedStartDate.getDate());
  const utc2 = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  let totalDays = Math.floor((utc2 - utc1) / msInDay) + 1;
  
  // Pad totalDays to complete the last week (multiple of 7)
  const remainder = totalDays % 7;
  if (remainder !== 0) totalDays += (7 - remainder);

  const numWeeks = totalDays / 7;

  // Configure grid for horizontal flow
  calendarGrid.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;
  calendarGrid.style.gridTemplateRows = `repeat(7, 1fr)`;
  calendarGrid.style.gridAutoFlow = `column`;

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(alignedStartDate);
    current.setDate(current.getDate() + i);
    
    const cell = document.createElement("div");
    cell.className = "day";

    if (current < startDate || current > endDate) {
      cell.classList.add("empty");
      calendarGrid.appendChild(cell);
      continue;
    }

    const timestamp = Math.floor(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()) / 1000);
    const dayStart = timestamp;
    const dayEnd = timestamp + 86400;
    
    let count = 0;
    for (const [ts, c] of Object.entries(calendarData)) {
        const t = parseInt(ts, 10);
        if (t >= dayStart && t < dayEnd) {
            count += c;
        }
    }

    if (count > 0) {
      cell.classList.add("solved");
      if (count >= 10) cell.classList.add("level-4");
      else if (count >= 5) cell.classList.add("level-3");
      else if (count >= 3) cell.classList.add("level-2");
      else cell.classList.add("level-1");
    }

    cell.title = titleFormatter ? titleFormatter(current.getDate(), current.getMonth(), current.getFullYear(), count) : `${current.getDate()}/${current.getMonth() + 1}/${current.getFullYear()}: ${count} activity`;
    calendarGrid.appendChild(cell);
  }

  // --- Render X-Axis Month Labels ---
  const xAxisId = gridId.replace('-grid', '-x-axis');
  const xAxis = document.getElementById(xAxisId);
  if (xAxis) {
      xAxis.innerHTML = "";
      xAxis.style.display = "grid";
      xAxis.style.gridTemplateColumns = `repeat(${numWeeks}, 1fr)`;
      // Optionally match the gap of the calendar grid if needed
      xAxis.style.gap = calendarGrid.style.gap || '4px'; 
      
      let lastMonth = -1;
      for (let w = 0; w < numWeeks; w++) {
          const weekStartDay = new Date(alignedStartDate);
          weekStartDay.setDate(weekStartDay.getDate() + w * 7);
          
          const month = weekStartDay.getMonth();
          const cell = document.createElement("div");
          cell.className = "x-axis-label";
          
          // Only show label if the month changes, avoiding the very last column to prevent text clipping
          if (month !== lastMonth && w < numWeeks - 1) {
              cell.textContent = weekStartDay.toLocaleString('default', { month: 'short' });
              lastMonth = month;
          }
          xAxis.appendChild(cell);
      }
  }
}

// --- Codeforces Logic ---
let cfCalendarData = {};
let currentCFRenderYear = new Date().getFullYear();
let currentCFRenderMonth = new Date().getMonth();

async function loadCodeforcesStats() {
    try {
        const response = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
        const data = await response.json();

        if (data.status !== "OK") {
            document.getElementById("cf-current-rating").textContent = "Error";
            const chartContainer = document.querySelector('.chart-container');
            if (chartContainer) {
                chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-family:var(--font-mono);font-size:0.85rem;">Unable to load Codeforces chart.</div>';
            }
            return;
        }

        const contests = data.result;
        const ratings = contests.map(c => c.newRating);
        const labels = contests.map(c => new Date(c.ratingUpdateTimeSeconds * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));

        // Current rating
        const currentRating = ratings[ratings.length - 1] || 0;
        document.getElementById("cf-current-rating").textContent = currentRating;

        // Draw chart
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="cf-rating-chart"></canvas>';
        }
        const ctx = document.getElementById("cf-rating-chart").getContext("2d");
        
        Chart.defaults.color = '#999999';
        Chart.defaults.font.family = "'JetBrains Mono', monospace";

        const currentTheme = document.documentElement.getAttribute('data-theme') || (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');
        const initialLineColor = currentTheme === 'dark' ? '#ffffff' : '#111111';

        window.cfChart = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Rating",
                    data: ratings,
                    borderColor: initialLineColor, // Responsive color
                    borderWidth: 2,
                    pointBackgroundColor: "#ffffff",
                    pointBorderColor: initialLineColor,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.1, // Less curved, more analytical look
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#ffffff',
                        titleColor: '#666666',
                        bodyColor: '#111111',
                        borderColor: '#eaeaea',
                        borderWidth: 1,
                        titleFont: { size: 12 },
                        bodyFont: { size: 14, weight: 'bold' },
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { maxTicksLimit: 6 }
                    },
                    y: {
                        grid: { color: '#f5f5f5', drawBorder: false },
                        border: { display: false }
                    }
                }
            }
        });

        // Heatmap Logic
        const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
        const statusData = await statusRes.json();
        
        if (statusData.status === "OK") {
            statusData.result.forEach(sub => {
                const t = sub.creationTimeSeconds;
                cfCalendarData[t] = (cfCalendarData[t] || 0) + 1;
            });
            renderCalendar("cf-calendar-grid", "cf-month", "cf-year", currentCFRenderYear, currentCFRenderMonth, cfCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} submissions`);
        }

        // Attach event listeners for calendar navigation
        const prevBtn = document.getElementById("cf-prev-month");
        const nextBtn = document.getElementById("cf-next-month");
        
        if (prevBtn) {
            prevBtn.addEventListener("click", () => {
            currentCFRenderMonth -= 6;
            while (currentCFRenderMonth < 0) {
                currentCFRenderMonth += 12;
                currentCFRenderYear--;
            }
            renderCalendar("cf-calendar-grid", "cf-month", "cf-year", currentCFRenderYear, currentCFRenderMonth, cfCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} submissions`);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
            currentCFRenderMonth += 6;
            while (currentCFRenderMonth > 11) {
                currentCFRenderMonth -= 12;
                currentCFRenderYear++;
            }
            renderCalendar("cf-calendar-grid", "cf-month", "cf-year", currentCFRenderYear, currentCFRenderMonth, cfCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} submissions`);
            });
        }
    } catch (error) {
        console.error("Codeforces fetch error:", error);
        document.getElementById("cf-current-rating").textContent = "N/A";
        const chartContainer = document.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);font-family:var(--font-mono);font-size:0.85rem;">Unable to load Codeforces chart.</div>';
        }
        const grid = document.getElementById("cf-calendar-grid");
        if (grid) {
            grid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">Unable to load submissions calendar.</p>';
        }
    }
}

// --- GitHub Logic ---
async function loadGitHubStats() {
    try {
        const userRes = await fetch(`https://api.github.com/users/${ghUsername}`);
        const userData = await userRes.json();

        if (userRes.ok) {
            document.getElementById("gh-public-repos").textContent = userData.public_repos;
            document.getElementById("gh-followers").textContent = userData.followers;
        }

        const reposRes = await fetch(`https://api.github.com/users/${ghUsername}/repos?per_page=100&sort=pushed`);
        const reposData = await reposRes.json();

        if (reposRes.ok) {
            const totalStars = reposData.reduce((acc, repo) => acc + repo.stargazers_count, 0);
            document.getElementById("gh-total-stars").textContent = totalStars;

            const topRepos = reposData
                .filter(repo => !repo.fork)
                .sort((a, b) => b.stargazers_count - a.stargazers_count)
                .slice(0, 4);

            const reposContainer = document.getElementById("gh-top-repos");
            reposContainer.innerHTML = ''; 

            topRepos.forEach(repo => {
                const card = document.createElement('div');
                card.className = 'project-card';
                card.innerHTML = `
                    <div class="project-image">
                        <i class="fab fa-github"></i>
                    </div>
                    <div class="project-content">
                        <div class="project-header">
                            <a href="${repo.html_url}" target="_blank" class="project-title">${repo.name}</a>
                            <div class="project-links">
                                <a href="${repo.html_url}" target="_blank"><i class="fab fa-github"></i></a>
                                ${repo.homepage ? `<a href="${repo.homepage}" target="_blank"><i class="fas fa-external-link-alt"></i></a>` : ''}
                            </div>
                        </div>
                        <p class="project-desc">${repo.description || 'A software project developed by Akshit Kumar Tiwari.'}</p>
                        
                        <span class="tech-stack-label">TECHSTACKS</span>
                        <div class="tech-stack">
                            ${(() => {
                                const detected = [];
                                const name = repo.name.toLowerCase();
                                const desc = (repo.description || '').toLowerCase();
                                const lang = repo.language;

                                if (name.includes('react') || desc.includes('react')) detected.push({ name: 'React', icon: 'fab fa-react', color: '#61dafb' });
                                if (name.includes('next') || desc.includes('next')) detected.push({ name: 'Next.js', icon: 'fab fa-node-js', color: '#fff', isNext: true });
                                if (name.includes('tailwind') || desc.includes('tailwind')) detected.push({ name: 'Tailwind', icon: 'fas fa-wind', color: '#38bdf8' });
                                if (name.includes('typescript') || name.includes('ts-') || desc.includes('typescript')) detected.push({ name: 'TypeScript', icon: 'fab fa-js-square', color: '#3178c6', isTS: true });
                                if (name.includes('node') || desc.includes('node') || desc.includes('express')) detected.push({ name: 'Node.js', icon: 'fab fa-node-js', color: '#68a063' });
                                if (name.includes('supabase') || desc.includes('supabase')) detected.push({ name: 'Supabase', icon: 'fas fa-bolt', color: '#3ecf8e' });

                                if (lang && !detected.some(t => t.name.toLowerCase() === lang.toLowerCase())) {
                                    let iconClass = 'fas fa-code';
                                    let color = '#666';
                                    const l = lang.toLowerCase();
                                    if (l === 'javascript') { iconClass = 'fab fa-js'; color = '#f7df1e'; }
                                    else if (l === 'typescript') { iconClass = 'fab fa-js-square'; color = '#3178c6'; }
                                    else if (l === 'python') { iconClass = 'fab fa-python'; color = '#3776ab'; }
                                    else if (l === 'html') { iconClass = 'fab fa-html5'; color = '#e34f26'; }
                                    else if (l === 'css') { iconClass = 'fab fa-css3-alt'; color = '#1572b6'; }
                                    else if (l === 'java') { iconClass = 'fab fa-java'; color = '#007396'; }
                                    else if (l === 'c++' || l === 'cpp') { iconClass = 'fas fa-code'; color = '#00599c'; }
                                    detected.push({ name: lang, icon: iconClass, color });
                                }

                                if (detected.length === 0) {
                                    detected.push({ name: 'Software', icon: 'fas fa-code', color: '#666' });
                                }

                                return detected.slice(0, 3).map(t => {
                                    if (t.isNext) {
                                        return `<span class="tech-pill"><span style="background: var(--text-primary); color: var(--bg-color); width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 900; border-radius: 50%; line-height: 1; margin-right: 4px;">N</span> Next.js</span>`;
                                    }
                                    if (t.isTS) {
                                        return `<span class="tech-pill"><span style="background: #3178c6; color: white; width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: bold; border-radius: 2px; line-height: 1; margin-right: 4px;">TS</span> TypeScript</span>`;
                                    }
                                    return `<span class="tech-pill"><i class="${t.icon}" style="color:${t.color};"></i> ${t.name}</span>`;
                                }).join('');
                            })()}
                            <span class="tech-pill" style="margin-left: auto; border: none; background: transparent; padding: 0;"><i class="fas fa-star" style="color:#fbbf24; margin-right: 4px;"></i> ${repo.stargazers_count}</span>
                        </div>

                        <div class="project-footer">
                            <div class="status">
                                <span class="status-dot"></span> Completed
                            </div>
                            <a href="${repo.html_url}" target="_blank" class="view-details">View Details <i class="fas fa-chevron-right" style="font-size:0.7rem"></i></a>
                        </div>
                    </div>
                `;
                reposContainer.appendChild(card);
            });
        }
    } catch (error) {
        console.error("GitHub fetch error:", error);
        const reposContainer = document.getElementById("gh-top-repos");
        if (reposContainer) {
            reposContainer.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1; text-align: center;">Unable to load GitHub repositories.</p>';
        }
    }
}

// --- Blog Logic (Supabase) ---
function createBlogCard(post) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Read: ${post.title}`);

    const date = new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const tags = (post.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('');
    const coverHTML = post.cover_image
        ? `<div class="blog-card-cover"><img src="${post.cover_image}" alt="${post.title}" loading="lazy"></div>`
        : `<div class="blog-card-cover"><i class="fas fa-pen-nib blog-card-cover-icon"></i></div>`;

    card.innerHTML = `
        ${coverHTML}
        <div class="blog-card-body">
            <div class="blog-card-tags">${tags}</div>
            <div class="blog-card-title">${post.title}</div>
            <div class="blog-card-excerpt">${post.excerpt || ''}</div>
            <div class="blog-card-meta">
                <span><i class="far fa-calendar"></i> ${date}</span>
                <span><i class="far fa-clock"></i> ${post.read_time} min</span>
                <span><i class="far fa-eye"></i> ${post.views}</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openPostModal(post.id));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openPostModal(post.id); });
    return card;
}

async function loadBlogPosts() {
    const blogGrid = document.getElementById('blog-grid');
    if (!blogGrid) return;

    try {
        const { data: posts, error } = await supabaseClient
            .from('posts')
            .select('id, title, slug, excerpt, cover_image, tags, created_at, read_time, views')
            .eq('published', true)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(4);

        if (error) throw error;

        if (!posts || posts.length === 0) {
            blogGrid.innerHTML = `
                <div class="blog-empty">
                    <i class="fas fa-pen-nib"></i>
                    <p>No posts yet — check back soon.</p>
                </div>`;
            return;
        }

        blogGrid.innerHTML = '';
        posts.forEach(post => blogGrid.appendChild(createBlogCard(post)));

    } catch (err) {
        console.error('Blog fetch error:', err);
        const blogGrid = document.getElementById('blog-grid');
        if (blogGrid) blogGrid.innerHTML = `<div class="blog-empty"><p>Unable to load posts.</p></div>`;
    }
}

async function openPostModal(postId) {
    const modal = document.getElementById('post-modal');
    const body = document.getElementById('modal-content-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    body.innerHTML = '<div class="modal-loading"><i class="fas fa-circle-notch fa-spin"></i></div>';

    const { data: post, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

    if (error || !post) {
        body.innerHTML = '<div class="modal-body"><p>Unable to load this post.</p></div>';
        return;
    }

    // Fire-and-forget view count increment
    try {
        await supabaseClient.rpc('increment_views', {
            post_id: post.id
        });
    } catch (err) {
        console.error('Failed to increment views:', err);
    }

    const date = new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const tags = (post.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('');
    const coverHTML = post.cover_image ? `<img src="${post.cover_image}" class="modal-cover" alt="${post.title}">` : '';

    body.innerHTML = `
        ${coverHTML}
        <div class="modal-body">
            <div class="modal-tags">${tags}</div>
            <h1 class="modal-title">${post.title}</h1>
            <div class="modal-meta">
                <span><i class="far fa-calendar"></i> ${date}</span>
                <span><i class="far fa-clock"></i> ${post.read_time} min read</span>
                <span><i class="far fa-eye"></i> ${(post.views || 0) + 1} views</span>
            </div>
            <div class="modal-markdown">${marked.parse(post.content || '')}</div>
        </div>
    `;
}

function closePostModal() {
    const modal = document.getElementById('post-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- LeetCode Heatmap & Stats renderLogic ---
let lcCalendarData = {};
let currentRenderYear = new Date().getFullYear();
let currentRenderMonth = new Date().getMonth();

async function loadLeetCodeStats() {
  const username = "RintuRifle";
  
  // Attach event listeners for calendar navigation
  const prevBtn = document.getElementById("lc-prev-month");
  const nextBtn = document.getElementById("lc-next-month");
  
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentRenderMonth -= 6;
      while (currentRenderMonth < 0) {
        currentRenderMonth += 12;
        currentRenderYear--;
      }
      renderCalendar("lc-calendar-grid", "lc-month", "lc-year", currentRenderYear, currentRenderMonth, lcCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} solved`);
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentRenderMonth += 6;
      while (currentRenderMonth > 11) {
        currentRenderMonth -= 12;
        currentRenderYear++;
      }
      renderCalendar("lc-calendar-grid", "lc-month", "lc-year", currentRenderYear, currentRenderMonth, lcCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} solved`);
    });
  }

  try {
    // Fetch stats
    const statsRes = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/solved`);
    const statsType = statsRes.headers.get("content-type") || "";
    if (!statsRes.ok || !statsType.includes("application/json")) {
      throw new Error(`Invalid API response (Status: ${statsRes.status}, Type: ${statsType})`);
    }
    const statsData = await statsRes.json();
    
    if (statsData) {
      if (document.getElementById("lc-total-solved")) document.getElementById("lc-total-solved").textContent = statsData.solvedProblem || 0;
      if (document.getElementById("lc-easy-solved")) document.getElementById("lc-easy-solved").textContent = statsData.easySolved || 0;
      if (document.getElementById("lc-medium-solved")) document.getElementById("lc-medium-solved").textContent = statsData.mediumSolved || 0;
      if (document.getElementById("lc-hard-solved")) document.getElementById("lc-hard-solved").textContent = statsData.hardSolved || 0;
    }

    // Fetch calendar
    const calRes = await fetch(`https://alfa-leetcode-api.onrender.com/${username}/calendar`);
    const calType = calRes.headers.get("content-type") || "";
    if (!calRes.ok || !calType.includes("application/json")) {
      throw new Error(`Invalid API response (Status: ${calRes.status}, Type: ${calType})`);
    }
    const calData = await calRes.json();
    
    if (calData && calData.submissionCalendar) {
      lcCalendarData = JSON.parse(calData.submissionCalendar);
      renderCalendar("lc-calendar-grid", "lc-month", "lc-year", currentRenderYear, currentRenderMonth, lcCalendarData, (d, m, y, c) => `${d}/${m + 1}/${y}: ${c} solved`);
    }
  } catch (error) {
    console.warn("LeetCode fetch error:", error.message || error);
    const grid = document.getElementById("lc-calendar-grid");
    if (grid) grid.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Unable to load LeetCode data.</p>';
  }
}


// --- Chakra Tech Stack Logic ---
function initChakra() {
    const icons = document.querySelectorAll('.chakra-icon');
    const center = document.getElementById('chakra-center');
    if (!center) return;
    const centerContent = center.querySelector('.chakra-center-content');
    const centerIcon = centerContent.querySelector('i');
    const centerText = centerContent.querySelector('span');
    const defaultColor = 'var(--text-secondary)';

    icons.forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            const name = icon.getAttribute('data-name');
            const color = icon.getAttribute('data-color');
            const iconClass = icon.querySelector('i').className;
            
            centerIcon.className = iconClass;
            centerIcon.style.color = color;
            centerText.textContent = name;
            centerText.style.color = color;
            center.style.borderColor = color;
            center.style.boxShadow = `0 4px 20px ${color}33`;
        });

        icon.addEventListener('mouseleave', () => {
            centerIcon.className = 'fas fa-code';
            centerIcon.style.color = defaultColor;
            centerText.textContent = 'Hover an icon';
            centerText.style.color = defaultColor;
            center.style.borderColor = 'var(--border-color)';
            center.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)';
        });
    });
}

// --- Contact Form Handling (Gmail) ---
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const submitBtn = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    if (contactForm && submitBtn) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Show loading state
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Sending...';
            formStatus.className = 'form-status hidden';
            
            // Gather data
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value;
            const currentTime = new Date().toISOString();

            // Format the email body
            const emailBody = `
                <h2>New Portfolio Message</h2>
                <p><strong>From:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <hr>
                <p>${message}</p>
                <hr>
                <p><small>Sent at: ${currentTime}</small></p>
            `;

            try {
                const response = await fetch('/api/send-email', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: ["rishimuni797658@gmail.com"], // Replace with your own email (MUST be verified in Resend if on free tier)
                        subject: `Portfolio: ${subject || 'New Message'}`,
                        text: emailBody,
                        html: emailBody
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    formStatus.textContent = data.message || 'Message sent successfully!';
                    formStatus.className = 'form-status success';
                    contactForm.reset(); // Clear form
                } else {
                    console.error("Resend Error:", data.error);
                    formStatus.textContent = data.error?.message || 'Failed to send message. Please try again.';
                    formStatus.className = 'form-status error';
                }

            } catch (error) {
                formStatus.textContent = 'An error occurred. Please email me directly.';
                formStatus.className = 'form-status error';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
            }
        });
    }
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    loadCodeforcesStats();
    loadGitHubStats();
    loadBlogPosts();
    loadLeetCodeStats();
    initChakra();
    initRocketScroll();

    // Modal close handlers
    document.getElementById('modal-close')?.addEventListener('click', closePostModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closePostModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePostModal(); });

    // Theme toggle
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        const themeIcon = themeBtn.querySelector('i');
        
        // Check saved theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
        
        themeBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                themeIcon.classList.replace('fa-moon', 'fa-sun');
                if (window.cfChart) {
                    window.cfChart.data.datasets[0].borderColor = '#111111';
                    window.cfChart.data.datasets[0].pointBorderColor = '#111111';
                    window.cfChart.update();
                }
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeIcon.classList.replace('fa-sun', 'fa-moon');
                if (window.cfChart) {
                    window.cfChart.data.datasets[0].borderColor = '#ffffff';
                    window.cfChart.data.datasets[0].pointBorderColor = '#ffffff';
                    window.cfChart.update();
                }
            }
        });
    }

    // Role Animation
    const roles = ["Software Engineer", "Competitive Programmer", "ML Engineer"];
    let roleIndex = 0;
    const roleElement = document.getElementById("role-text");
    if (roleElement) {
        setInterval(() => {
            roleElement.classList.add("fade-out");
            setTimeout(() => {
                roleIndex = (roleIndex + 1) % roles.length;
                roleElement.textContent = roles[roleIndex];
                roleElement.classList.remove("fade-out");
                roleElement.classList.add("fade-in");
                setTimeout(() => roleElement.classList.remove("fade-in"), 400);
            }, 400);
        }, 3000);
    }
});

// ── Multi-Mode Animated Canvas Background System ─────────────────────────────
(function initBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W, H, animFrame, scene = {};
    let currentMode = localStorage.getItem('bgMode') || 'constellation';

    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    function lc(alpha) {
        return isDark() ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    }

    // ── CIRCUIT ──────────────────────────────────────────────────────────────
    function initCircuit() {
        const GRID = 60;
        function snap(v) { return Math.round(v / GRID) * GRID; }
        function rp() {
            return {
                x: snap(Math.floor(Math.random() * Math.floor(W / GRID)) * GRID + GRID),
                y: snap(Math.floor(Math.random() * Math.floor(H / GRID)) * GRID + GRID),
            };
        }
        function mkPath() {
            const a = rp(), b = rp(), mid = { x: b.x, y: a.y };
            const totalLen = Math.max(Math.abs(b.x - a.x) + Math.abs(b.y - a.y), GRID);
            return {
                points: [a, mid, b],
                segments: [{ x1: a.x, y1: a.y, x2: mid.x, y2: mid.y }, { x1: mid.x, y1: mid.y, x2: b.x, y2: b.y }],
                totalLen, progress: Math.random() * totalLen, speed: 0.6 * (0.5 + Math.random()),
            };
        }
        scene = { nodes: Array.from({ length: 22 }, rp), paths: Array.from({ length: 12 }, mkPath) };
    }
    function drawCircuit() {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = lc(isDark() ? 0.07 : 0.06);
        ctx.lineWidth = 1;
        for (const p of scene.paths) {
            ctx.beginPath();
            ctx.moveTo(p.points[0].x, p.points[0].y);
            for (let i = 1; i < p.points.length; i++) ctx.lineTo(p.points[i].x, p.points[i].y);
            ctx.stroke();
        }
        for (let i = 0; i < scene.nodes.length; i++) {
            const n = scene.nodes[i], sz = 5;
            ctx.save(); ctx.translate(n.x, n.y);
            if (i % 3 === 0) {
                ctx.rotate(Math.PI / 4); ctx.strokeStyle = lc(0.16); ctx.lineWidth = 1.2;
                ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
            } else {
                ctx.fillStyle = lc(0.16); ctx.beginPath(); ctx.arc(0, 0, sz * 0.8, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        for (const p of scene.paths) {
            p.progress = (p.progress + p.speed) % p.totalLen;
            let rem = p.progress, pos;
            for (const seg of p.segments) {
                const len = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1);
                if (rem <= len) { const t = len > 0 ? rem / len : 0; pos = { x: seg.x1 + (seg.x2 - seg.x1) * t, y: seg.y1 + (seg.y2 - seg.y1) * t }; break; }
                rem -= len;
            }
            if (!pos) pos = p.points[p.points.length - 1];
            const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 8);
            g.addColorStop(0, lc(isDark() ? 0.7 : 0.5)); g.addColorStop(1, 'transparent');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = lc(isDark() ? 0.55 : 0.45); ctx.beginPath(); ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ── WAVES ────────────────────────────────────────────────────────────────
    function initWaves() {
        scene = {
            t: 0,
            waves: Array.from({ length: 10 }, (_, i) => ({
                amplitude: 18 + i * 7,
                frequency: 0.007 + i * 0.0008,
                speed: 0.006 + i * 0.002,
                phase: (i / 10) * Math.PI * 2,
                y: (H / 11) * (i + 1),
                alpha: 0.035 + i * 0.008,
            })),
        };
    }
    function drawWaves() {
        ctx.clearRect(0, 0, W, H);
        scene.t += 1;
        for (const w of scene.waves) {
            ctx.beginPath();
            ctx.strokeStyle = lc(isDark() ? w.alpha * 2.8 : w.alpha);
            ctx.lineWidth = 1;
            for (let x = 0; x <= W; x += 2) {
                const y = w.y + Math.sin(x * w.frequency + scene.t * w.speed + w.phase) * w.amplitude;
                x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }

    // ── SPIRAL ───────────────────────────────────────────────────────────────
    function initSpiral() { scene = { t: 0 }; }
    function drawSpiral() {
        ctx.clearRect(0, 0, W, H);
        scene.t += 0.003;
        const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) * 0.44;
        const arms = 3;
        for (let arm = 0; arm < arms; arm++) {
            const offset = (arm / arms) * Math.PI * 2;
            ctx.beginPath();
            ctx.strokeStyle = lc(isDark() ? 0.11 : 0.07);
            ctx.lineWidth = 1;
            for (let i = 0; i <= 600; i++) {
                const t = (i / 600) * 7 * Math.PI * 2 + scene.t + offset;
                const r = (i / 600) * maxR;
                const x = cx + r * Math.cos(t), y = cy + r * Math.sin(t);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
        g.addColorStop(0, lc(isDark() ? 0.2 : 0.12)); g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 50, 0, Math.PI * 2); ctx.fill();
    }

    // ── CONSTELLATION ────────────────────────────────────────────────────────
    function initConstellation() {
        const count = Math.min(80, Math.floor((W * H) / 18000));
        scene = {
            stars: Array.from({ length: count }, () => ({
                x: Math.random() * W, y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
                r: Math.random() * 1.4 + 0.5,
            })),
            dist: 130,
        };
    }
    function drawConstellation() {
        ctx.clearRect(0, 0, W, H);
        const { stars, dist } = scene;
        for (const s of stars) {
            s.x = (s.x + s.vx + W) % W;
            s.y = (s.y + s.vy + H) % H;
        }
        for (let i = 0; i < stars.length; i++) {
            for (let j = i + 1; j < stars.length; j++) {
                const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < dist) {
                    ctx.strokeStyle = lc((1 - d / dist) * (isDark() ? 0.2 : 0.1));
                    ctx.lineWidth = 0.5;
                    ctx.beginPath(); ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[j].x, stars[j].y); ctx.stroke();
                }
            }
        }
        ctx.fillStyle = lc(isDark() ? 0.4 : 0.25);
        for (const s of stars) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    }

    // ── TREE ─────────────────────────────────────────────────────────────────
    function initTree() { scene = { t: 0 }; }
    function branch(x, y, angle, len, depth) {
        if (depth === 0 || len < 2) return;
        const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
        ctx.strokeStyle = lc(isDark() ? Math.min(0.55, 0.1 * depth) : Math.min(0.3, 0.055 * depth));
        ctx.lineWidth = depth * 0.45;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
        const sway = Math.sin(scene.t + depth * 0.5) * 0.04;
        branch(ex, ey, angle - 0.42 + sway, len * 0.68, depth - 1);
        branch(ex, ey, angle + 0.42 + sway, len * 0.68, depth - 1);
    }
    function drawTree() {
        ctx.clearRect(0, 0, W, H);
        scene.t += 0.014;
        branch(W / 2, H, -Math.PI / 2, Math.min(H * 0.22, 160), 10);
    }

    // ── NONE ─────────────────────────────────────────────────────────────────
    function initNone() { scene = {}; }
    function drawNone() { ctx.clearRect(0, 0, W, H); }

    // ── ENGINE ───────────────────────────────────────────────────────────────
    const MODES = {
        circuit:       { init: initCircuit,       draw: drawCircuit },
        waves:         { init: initWaves,          draw: drawWaves },
        spiral:        { init: initSpiral,         draw: drawSpiral },
        constellation: { init: initConstellation,  draw: drawConstellation },
        tree:          { init: initTree,           draw: drawTree },
        none:          { init: initNone,           draw: drawNone },
    };

    function loop() {
        const m = MODES[currentMode] || MODES.circuit;
        m.draw();
        if (currentMode !== 'none') animFrame = requestAnimationFrame(loop);
    }

    function setMode(mode) {
        cancelAnimationFrame(animFrame);
        currentMode = mode;
        localStorage.setItem('bgMode', mode);
        scene = {};
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        (MODES[mode] || MODES.circuit).init();
        loop();
        document.querySelectorAll('.bg-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.bg === mode);
        });
    }

    function resize() {
        cancelAnimationFrame(animFrame);
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
        scene = {};
        (MODES[currentMode] || MODES.circuit).init();
        loop();
    }

    window.addEventListener('resize', resize);
    setMode(currentMode);

    // Hook up picker buttons (may not exist yet — delegate after DOM ready)
    document.addEventListener('click', e => {
        const btn = e.target.closest('.bg-option');
        if (btn) setMode(btn.dataset.bg);
    });
})();

// ── Live Visitor Counter ─────────────────────────────────────────────────────
(async function initVisitorCounter() {
    const counterEl = document.getElementById('visit-count');
    if (!counterEl) return;

    try {
        // Increment and get new value from counter API
        const res = await fetch('https://api.counterapi.dev/v1/RintuRifle_portfolio/visits/up');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        
        const targetValue = data.value || 1;
        let currentValue = Math.max(0, targetValue - 25); // Start slightly lower for polished animation
        
        const interval = setInterval(() => {
            if (currentValue >= targetValue) {
                counterEl.textContent = targetValue.toLocaleString();
                clearInterval(interval);
            } else {
                currentValue += Math.ceil((targetValue - currentValue) / 4);
                counterEl.textContent = currentValue.toLocaleString();
            }
        }, 50);
        
    } catch (err) {
        console.warn('Visitor counter API failed, using local fallback:', err);
        // Fallback: LocalStorage mock to always stay working smoothly
        let visits = parseInt(localStorage.getItem('localVisits') || '1428');
        visits += 1;
        localStorage.setItem('localVisits', visits);
        counterEl.textContent = visits.toLocaleString();
    }
})();

// --- Rocket Scroll-to-Top Logic ---
function initRocketScroll() {
    const rocketBtn = document.getElementById('rocket-scroll-top');
    if (!rocketBtn) return;

    // Show/hide button on scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            rocketBtn.classList.add('show');
        } else {
            // Only hide if not currently launching
            if (!rocketBtn.classList.contains('launching') && !rocketBtn.classList.contains('fly-away')) {
                rocketBtn.classList.remove('show');
            }
        }
    });

    // Launch rocket on click
    rocketBtn.addEventListener('click', () => {
        if (rocketBtn.classList.contains('launching') || rocketBtn.classList.contains('fly-away')) return;

        rocketBtn.classList.add('launching');

        // Create flame/smoke particle effects!
        const particleInterval = setInterval(() => {
            createRocketFlame(rocketBtn);
        }, 30);

        // After some rumbling, blast off!
        setTimeout(() => {
            clearInterval(particleInterval);
            rocketBtn.classList.remove('launching');
            
            // Force reflow so the transition registers correctly
            void rocketBtn.offsetWidth;
            
            rocketBtn.classList.add('fly-away');

            // Burst of final flames
            for(let i=0; i<5; i++) createRocketFlame(rocketBtn);

            // Smooth scroll to top
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

            // Reset rocket position after it flies out and page scrolls
            setTimeout(() => {
                rocketBtn.style.transition = 'none'; // Prevent drop animation
                rocketBtn.classList.remove('fly-away');
                rocketBtn.classList.remove('show');
                
                void rocketBtn.offsetWidth; // Force reflow
                
                rocketBtn.style.transition = ''; // Restore transition
            }, 1200);

        }, 400); // 400ms rumble time
    });
}

function createRocketFlame(button) {
    const rect = button.getBoundingClientRect();
    const flame = document.createElement('span');
    flame.className = 'rocket-flame';
    
    // Randomize flame type (red or yellow spark)
    if (Math.random() > 0.4) {
        flame.classList.add('spark');
    }

    // Position flame at the bottom of the button
    const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 20;
    const y = rect.top + rect.height;

    flame.style.left = `${x}px`;
    flame.style.top = `${y}px`;

    // Randomize drift direction
    const dx = (Math.random() - 0.5) * 30;
    const dy = 20 + Math.random() * 40;

    flame.style.setProperty('--dx', `${dx}px`);
    flame.style.setProperty('--dy', `${dy}px`);

    document.body.appendChild(flame);

    // Remove flame after animation completes
    setTimeout(() => {
        flame.remove();
    }, 600);
}