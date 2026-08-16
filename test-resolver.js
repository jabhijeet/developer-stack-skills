const resolver = require("./lib/resolver");

async function testResolver() {
  try {
    console.log("Testing resolver function...");
    
    // Test Cline agent in symlink mode
    const clinePath = await resolver.resolveSkillPath("cline", "symlink");
    console.log(`Cline symlink path: ${clinePath}`);
    
    // Test Claude agent in copy mode (project directory context)
    const claudePath = await resolver.resolveSkillPath("claude", "copy");
    console.log(`Claude copy path: ${claudePath}`);
    
    // Test invalid agent
    try {
      await resolver.resolveSkillPath("nonexistent-agent", "symlink");
    } catch (err) {
      console.log(`Expected error for invalid agent: ${err.message}`);
    }
    
    // Test invalid mode
    try {
      await resolver.resolveSkillPath("cursor", "invalid-mode");
    } catch (err) {
      console.log(`Expected error for invalid mode: ${err.message}`);
    }
    
    console.log("Resolver tests completed.");
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

testResolver();